// import {AppInterface} from '../models/app/app.js'
import {AppManifest} from '../models/app/app.js'
import {AssetUrlSchema, DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {MinimalAppIdentifiers} from '../models/organization.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {brotliCompress, zip} from '@shopify/cli-kit/node/archiver'
import {fetch} from '@shopify/cli-kit/node/http'
import {fileSize, readFileSync} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {writeFile} from 'fs/promises'

const MEGABYTE = 1024 * 1024
const MAX_BUNDLE_SIZE_MB = 100
const MAX_BUNDLE_SIZE_BYTES = MAX_BUNDLE_SIZE_MB * MEGABYTE

export async function writeManifestToBundle(appManifest: AppManifest, bundlePath: string) {
  const manifestPath = joinPath(bundlePath, 'manifest.json')
  await writeFile(manifestPath, JSON.stringify(appManifest, null, 2))
}

export const BUNDLE_EXCLUSION_PATTERNS = ['!**/*.js.map', '!**/*.metafile.json']

export async function compressBundle(inputDirectory: string, outputPath: string, customMatchFilePattern?: string[]) {
  const matchFilePattern = customMatchFilePattern ?? ['**/*', ...BUNDLE_EXCLUSION_PATTERNS]
  if (outputPath.endsWith('.br')) {
    await brotliCompress({inputDirectory, outputPath, matchFilePattern})
  } else {
    await zip({inputDirectory, outputZipPath: outputPath, matchFilePattern})
  }
}

/**
 * Upload a file to GCS
 * @param signedURL - The signed URL to upload the file to
 * @param filePath - The path to the file
 */
export async function uploadToGCS(signedURL: string, filePath: string) {
  const size = await fileSize(filePath)
  if (size > MAX_BUNDLE_SIZE_BYTES) {
    // Round up so a size that barely exceeds the cap never displays as the cap.
    const humanSize = `${(Math.ceil((size / MEGABYTE) * 100) / 100).toFixed(2)} MB`
    throw new AbortError(
      `Your app bundle exceeds the ${MAX_BUNDLE_SIZE_MB} MB upload limit (it is ${humanSize}).`,
      `Check the asset paths in your extension configuration — a misconfigured source can pull in much more than intended. Exclude large files or directories from your bundle, then try again.`,
    )
  }
  const buffer = readFileSync(filePath)
  // The body is the raw file buffer, not a multipart-encoded form: GCS stores the bytes from this
  // signed PUT as-is. The previous `form-data`-based implementation also sent the raw buffer as the
  // body while only borrowing form-data's `multipart/form-data; boundary=...` header, so the
  // boundary never delimited anything on the wire. We keep that exact content-type shape here to
  // preserve wire behaviour; because nothing parses the boundary, a fixed value is equivalent to the
  // random one form-data generated per request — and it keeps the request deterministic and testable.
  await fetch(
    signedURL,
    {
      method: 'put',
      body: buffer,
      headers: {
        'content-type': 'multipart/form-data; boundary=---shopify-cli-upload-boundary---',
      },
    },
    'slow-request',
  )
}

/**
 * It generates a URL to upload an app bundle.
 * @param apiKey - The application API key
 */
export async function getUploadURL(developerPlatformClient: DeveloperPlatformClient, app: MinimalAppIdentifiers) {
  const result: AssetUrlSchema = await developerPlatformClient.generateSignedUploadUrl(app)

  if (!result.assetUrl || result.userErrors?.length > 0) {
    const errors = result.userErrors.map((error) => error.message).join(', ')
    throw new AbortError(errors)
  }

  return result.assetUrl
}

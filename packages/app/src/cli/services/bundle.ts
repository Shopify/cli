// import {AppInterface} from '../models/app/app.js'
import {AppManifest} from '../models/app/app.js'
import {AssetUrlSchema, DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {MinimalAppIdentifiers} from '../models/organization.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {brotliCompress, zip} from '@shopify/cli-kit/node/archiver'
import {fetch, Response} from '@shopify/cli-kit/node/http'
import {fileSize, readFileSync} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {sleep} from '@shopify/cli-kit/node/system'
import {writeFile} from 'fs/promises'

const MEGABYTE = 1024 * 1024
const MAX_BUNDLE_SIZE_MB = 100
const MAX_BUNDLE_SIZE_BYTES = MAX_BUNDLE_SIZE_MB * MEGABYTE

// A signed PUT upload is idempotent (same object key, same bytes), so it is safe
// to retry. We only retry statuses that are plausibly transient.
const UPLOAD_MAX_ATTEMPTS = 3
const RETRYABLE_UPLOAD_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504])

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
 * Upload a file to GCS using a signed URL.
 *
 * GCS replies to the signed PUT with a non-2xx status code when the upload fails
 * (for example an expired signature, a malformed request, or a transient server
 * error). The status code MUST be checked: `fetch` does not throw on a non-2xx
 * HTTP response, so if it is ignored a failed upload is silently treated as a
 * success and the caller proceeds to reference an object that was never stored.
 * That surfaces downstream as a confusing "Uploaded file not found" error when
 * the bundle is consumed (e.g. during devSessionCreate).
 *
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

  let response: Response | undefined
  for (let attempt = 1; attempt <= UPLOAD_MAX_ATTEMPTS; attempt++) {
    // The signed URL only signs the `host` header, so no extra headers are
    // required; node-fetch derives Content-Length from the buffer body.
    // eslint-disable-next-line no-await-in-loop
    response = await fetch(signedURL, {method: 'put', body: buffer}, 'slow-request')
    if (response.ok) return
    const lastAttempt = attempt === UPLOAD_MAX_ATTEMPTS
    const retryable = RETRYABLE_UPLOAD_STATUS_CODES.has(response.status)
    // node-fetch keeps the socket open until the body is consumed. On the final
    // attempt we read it below for the error message; otherwise drain it here so
    // the connection can be reused or released before the next attempt.
    if (retryable && !lastAttempt) {
      // eslint-disable-next-line no-await-in-loop
      await response.text().catch(() => {})
      // eslint-disable-next-line no-await-in-loop
      await sleep(2 ** attempt * 0.1)
      continue
    }
    break
  }

  const status = response?.status
  const responseBody = (await response?.text().catch(() => ''))?.trim()
  throw new AbortError(
    `Failed to upload your app bundle to storage${status ? ` (HTTP ${status})` : ''}.`,
    'This is usually transient. Please try again, and check your network connection if it persists.',
    responseBody ? [`Storage responded with: ${responseBody.slice(0, 300)}`] : undefined,
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

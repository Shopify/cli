// import {AppInterface} from '../models/app/app.js'
import {AppManifest} from '../models/app/app.js'
import {AssetUrlSchema, DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {MinimalAppIdentifiers} from '../models/organization.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {brotliCompress, zip} from '@shopify/cli-kit/node/archiver'
import {formData, fetch} from '@shopify/cli-kit/node/http'
import {readFileSync} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {writeFile} from 'fs/promises'

export async function writeManifestToBundle(appManifest: AppManifest, bundlePath: string) {
  const manifestPath = joinPath(bundlePath, 'manifest.json')
  await writeFile(manifestPath, JSON.stringify(appManifest, null, 2))
}

export async function compressBundle(inputDirectory: string, outputPath: string, customMatchFilePattern?: string[]) {
  const matchFilePattern = customMatchFilePattern ?? ['**/*', '!**/*.js.map']
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
  const form = formData()
  const buffer = readFileSync(filePath)
  form.append('my_upload', buffer)
  await fetch(signedURL, {method: 'put', body: buffer, headers: form.getHeaders()}, 'slow-request')
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

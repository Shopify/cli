// import {AppInterface} from '../models/app/app.js'
import {AppInterface} from '../models/app/app.js'
import {AssetUrlSchema, DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {MinimalAppIdentifiers} from '../models/organization.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {zip} from '@shopify/cli-kit/node/archiver'
import {formData, fetch} from '@shopify/cli-kit/node/http'
import {readFileSync} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {writeFile} from 'fs/promises'

export async function writeManifestToBundle(app: AppInterface, bundlePath: string) {
  const appManifest = await app.manifest()
  const manifestPath = joinPath(bundlePath, 'manifest.json')
  await writeFile(manifestPath, JSON.stringify(appManifest, null, 2))
}

export async function compressBundle(inputPath: string, outputPath: string) {
  await zip({
    inputDirectory: inputPath,
    outputZipPath: outputPath,
  })
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

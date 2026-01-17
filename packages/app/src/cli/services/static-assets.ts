import {compressBundle, getUploadURL, uploadToGCS} from './bundle.js'
import {AppInterface, isCurrentAppSchema} from '../models/app/app.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {MinimalAppIdentifiers} from '../models/organization.js'
import {joinPath, relativePath} from '@shopify/cli-kit/node/path'
import {copyFile, glob, mkdir, rmdir} from '@shopify/cli-kit/node/fs'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {renderInfo} from '@shopify/cli-kit/node/ui'

/**
 * Transforms a signed GCS URL for dev environment.
 * Changes bucket from partners-extensions-scripts-bucket to partners-extensions-scripts-dev-bucket
 * and changes path from /deployments/... to /hosted_app/...
 */
function transformSignedUrlForDev(signedURL: string): string {
  const url = new URL(signedURL)

  // Change bucket: partners-extensions-scripts-bucket -> partners-extensions-scripts-dev-bucket
  url.hostname = url.hostname.replace('partners-extensions-scripts-bucket', 'partners-extensions-scripts-dev-bucket')

  // Change path: /deployments/app_sources/... -> /hosted_app/...
  // Extract the app ID and unique ID from the original path
  const pathMatch = url.pathname.match(/\/deployments\/app_sources\/(\d+)\/([^/]+)\/(.+)/)
  if (pathMatch) {
    const [, appId, uniqueId, filename] = pathMatch
    url.pathname = `/hosted_app/${appId}/${uniqueId}/${filename}`
  }

  return url.toString()
}

/**
 * Copies static assets from the app's static_root directory to the bundle.
 * @param app - The app interface
 * @param bundleDirectory - The bundle directory to copy assets to
 */
export async function copyStaticAssetsToBundle(app: AppInterface, bundleDirectory: string): Promise<void> {
  if (!isCurrentAppSchema(app.configuration)) return

  const staticRoot = app.configuration.static_root
  if (!staticRoot) return

  const staticSourceDir = joinPath(app.directory, staticRoot)
  const staticOutputDir = joinPath(bundleDirectory, 'static')

  await mkdir(staticOutputDir)

  const files = await glob(joinPath(staticSourceDir, '**/*'), {onlyFiles: true})

  outputDebug(`Copying ${files.length} static assets from ${staticRoot} to bundle...`)

  await Promise.all(
    files.map(async (filepath) => {
      const relativePathName = relativePath(staticSourceDir, filepath)
      const outputFile = joinPath(staticOutputDir, relativePathName)
      return copyFile(filepath, outputFile)
    }),
  )
}

export interface UploadStaticAssetsOptions {
  app: AppInterface
  developerPlatformClient: DeveloperPlatformClient
  appId: MinimalAppIdentifiers
}

/**
 * Bundles and uploads static assets to GCS.
 * @param options - Upload options containing the app, developer platform client, and app identifiers
 * @returns The GCS URL where assets were uploaded, or undefined if no static_root configured
 */
export async function uploadStaticAssetsToGCS(options: UploadStaticAssetsOptions): Promise<string | undefined> {
  const {app, developerPlatformClient, appId} = options

  if (!isCurrentAppSchema(app.configuration)) return undefined

  const staticRoot = app.configuration.static_root
  if (!staticRoot) return undefined

  const staticSourceDir = joinPath(app.directory, staticRoot)
  const files = await glob(joinPath(staticSourceDir, '**/*'), {onlyFiles: true})

  if (files.length === 0) {
    outputDebug(`No static assets found in ${staticRoot}`)
    return undefined
  }

  // Create temp bundle directory
  const bundleDirectory = joinPath(app.directory, '.shopify', 'static-assets-bundle')
  await rmdir(bundleDirectory, {force: true})
  await mkdir(bundleDirectory)

  try {
    // Copy static assets to bundle
    await copyStaticAssetsToBundle(app, bundleDirectory)

    // Compress the bundle
    const bundlePath = joinPath(app.directory, '.shopify', 'static-assets.zip')
    await compressBundle(bundleDirectory, bundlePath)

    // Get signed URL, transform for dev bucket, and upload
    const signedURL = await getUploadURL(developerPlatformClient, appId)
    const devSignedURL = transformSignedUrlForDev(signedURL)
    outputDebug(`Transformed URL for dev: ${devSignedURL}`)
    await uploadToGCS(devSignedURL, bundlePath)

    renderInfo({
      headline: 'Static assets uploaded.',
      body: [`Uploaded ${files.length} static assets from "${staticRoot}" to dev GCS bucket`],
    })

    return devSignedURL
  } finally {
    // Clean up temp directory
    await rmdir(bundleDirectory, {force: true})
  }
}

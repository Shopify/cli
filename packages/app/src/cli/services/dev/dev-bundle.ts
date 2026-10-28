import {getUploadURL, uploadToGCS} from '../bundle.js'
import {MinimalAppIdentifiers} from '../../models/organization.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {joinPath} from '@shopify/cli-kit/node/path'

/**
 * The path of the compressed dev preview bundle in the given directory.
 *
 * @param directory - The directory that holds the compressed bundle.
 * @param developerPlatformClient - The client whose bundle format determines the extension.
 * @returns The compressed bundle path.
 */
export function devBundlePath(directory: string, developerPlatformClient: DeveloperPlatformClient): string {
  return joinPath(directory, `dev-bundle.${developerPlatformClient.bundleFormat}`)
}

interface UploadDevBundleOptions {
  developerPlatformClient: DeveloperPlatformClient
  app: MinimalAppIdentifiers
  bundlePath: string
  signal?: AbortSignal
}

/**
 * Uploads a compressed dev preview bundle to a signed URL.
 *
 * @param options - The client, app, compressed bundle path, and optional cancellation signal.
 * @returns The signed URL that the dev session API reads the bundle from.
 */
export async function uploadDevBundle({
  developerPlatformClient,
  app,
  bundlePath,
  signal,
}: UploadDevBundleOptions): Promise<string> {
  const signedURL = await getUploadURL(developerPlatformClient, app)
  signal?.throwIfAborted()
  await uploadToGCS(signedURL, bundlePath, signal)
  return signedURL
}

import {Bundle} from 'cli/models/app/bundle'
import {file, archiver} from '@shopify/cli-kit'

/**
 * Archives a bundle and generates a zip file that's uploadable to the Shopify platform.
 * @param bundle {Bundle} Bundle to be archived.
 * @param zipPath {string} Path to the output zip file.
 */
export async function archive(bundle: Bundle, zipPath: string): Promise<void> {
  await archiver.zip(bundle.bundleDirectory, zipPath)
  await file.rmdir(bundle.bundleDirectory)
}

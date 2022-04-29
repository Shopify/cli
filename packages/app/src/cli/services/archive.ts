import {Bundle} from 'cli/models/app/bundle'
import {file, archiver} from '@shopify/cli-kit'

export default async function archive(bundle: Bundle): Promise<string> {
  const outputZipPath = `${bundle.appDirectory}.zip`
  await archiver.zip(bundle.bundleDirectory, outputZipPath)
  await file.rmdir(bundle.bundleDirectory)

  return outputZipPath
}

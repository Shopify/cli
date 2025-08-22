import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {glob} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

const SUBDIRECTORY_NAME = 'specifications'
const includedFilePatterns = ['*.json', '*.toml', '*.yaml', '*.yml', '*.svg']

export async function channelSpecificationFiles(extension: ExtensionInstance): Promise<string[]> {
  const patterns = includedFilePatterns.map((pattern) =>
    joinPath(SUBDIRECTORY_NAME, '**', pattern)
  )
  return glob(patterns, {
    absolute: true,
    cwd: extension.directory,
  })
}

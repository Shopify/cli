import {AppInterface} from '../../models/app/app.js'
import {blocks, configurationFileNames} from '../../constants.js'
import {ExtensionFlavor} from '../../models/app/template.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fileExists, mkdir, touchFile} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {hyphenate} from '@shopify/cli-kit/common/string'

export async function ensureDownloadedExtensionFlavorExists(
  extensionFlavor: ExtensionFlavor | undefined,
  templateDownloadDir: string,
): Promise<string> {
  const templatePath = extensionFlavor?.path ?? ''
  const origin = joinPath(templateDownloadDir, templatePath)
  if (!(await fileExists(origin))) {
    throw new AbortError(`\nThe extension is not available for ${extensionFlavor?.value}`)
  }
  return origin
}

export async function ensureExtensionDirectoryExists({name, app}: {name: string; app: AppInterface}): Promise<string> {
  const hyphenizedName = hyphenate(name)
  const extensionDirectory = joinPath(app.directory, blocks.extensions.directoryName, hyphenizedName)
  if (await fileExists(extensionDirectory)) {
    throw new AbortError(
      `\nA directory with this name (${hyphenizedName}) already exists.\nChoose a new name for your extension.`,
    )
  }
  await mkdir(extensionDirectory)
  await touchFile(joinPath(extensionDirectory, configurationFileNames.lockFile))
  return extensionDirectory
}

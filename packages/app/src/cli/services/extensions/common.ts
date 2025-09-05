import {AppInterface} from '../../models/app/app.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {blocks, configurationFileNames} from '../../constants.js'
import {ExtensionFlavor} from '../../models/app/template.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fileExists, mkdir, touchFile} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {hyphenate} from '@shopify/cli-kit/common/string'
import {renderAutocompletePrompt} from '@shopify/cli-kit/node/ui'
import {isTerminalInteractive} from '@shopify/cli-kit/node/context/local'

export async function ensureDownloadedExtensionFlavorExists(
  extensionFlavor: ExtensionFlavor | undefined,
  templateDownloadDir: string,
): Promise<string> {
  const templatePath = extensionFlavor?.path || ''
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

export async function canEnablePreviewMode({
  localApp,
  developerPlatformClient,
  apiKey,
  organizationId,
}: {
  localApp: AppInterface
  developerPlatformClient: DeveloperPlatformClient
  apiKey: string
  organizationId: string
}) {
  const {dashboardManagedExtensionRegistrations} = (
    await developerPlatformClient.appExtensionRegistrations({
      id: apiKey,
      apiKey,
      organizationId,
    })
  ).app
  if (dashboardManagedExtensionRegistrations.length > 0) return true
  const themeExtensions = localApp.allExtensions.filter((ext) => ext.isThemeExtension)
  if (themeExtensions.length > 0) return true
  if (localApp.allExtensions.length > 0) return true

  return false
}

export async function chooseExtension(extensions: ExtensionInstance[], path: string): Promise<ExtensionInstance> {
  // Filter out app config extensions (like app_access, pos, etc.)
  const userExtensions = extensions.filter((ext) => !ext.isAppConfigExtension)

  if (userExtensions.length === 0) {
    throw new AbortError('No user extensions found in this app.')
  }

  const ourExtension = userExtensions.find((ext) => ext.directory === path)
  if (ourExtension) return ourExtension
  if (userExtensions.length === 1 && userExtensions[0]) return userExtensions[0]
  if (isTerminalInteractive()) {
    const selectedExtension = await renderAutocompletePrompt({
      message: 'Which extension?',
      choices: userExtensions.map((extension) => ({label: extension.localIdentifier, value: extension})),
    })
    return selectedExtension
  }
  throw new AbortError(
    'Run this command from an extension directory or use `--path` to specify an extension directory.',
  )
}

import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {ensureThemeExtensionDevContext} from '../context.js'

export async function themeExtensionArgs(
  extension: ExtensionInstance,
  apiKey: string,
  developerPlatformClient: DeveloperPlatformClient,
  options: {theme?: string; themeExtensionPort?: number; generateTmpTheme?: boolean; notify?: string},
) {
  const extensionRegistration = await ensureThemeExtensionDevContext(extension, apiKey, developerPlatformClient)
  const extensionId = extensionRegistration.id
  const directory = extension.directory
  const extensionTitle = extension.localIdentifier
  const extensionType = extension.graphQLType

  const args: string[] = [
    directory,
    '--api-key',
    apiKey,
    '--extension-id',
    extensionId,
    '--extension-title',
    extensionTitle,
    '--extension-type',
    extensionType,
  ]

  if (options.theme) {
    args.push('--theme', options.theme)
  }

  if (options.themeExtensionPort) {
    args.push('--port', options.themeExtensionPort.toString())
  }

  if (options.generateTmpTheme) {
    args.push('--generate-tmp-theme')
  }

  if (options.notify) {
    args.push('--notify', options.notify)
  }

  return args
}

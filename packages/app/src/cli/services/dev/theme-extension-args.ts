import {ExtensionInstance} from '../../models/extensions/extensions.js'
import {ensureThemeExtensionDevEnvironment} from '../environment.js'

export async function themeExtensionArgs(
  extension: ExtensionInstance,
  apiKey: string,
  token: string,
  options: {theme?: string; themeExtensionPort?: number},
) {
  const extensionRegistration = await ensureThemeExtensionDevEnvironment(extension, apiKey, token)
  const extensionId = extensionRegistration.id
  const directory = extension.directory
  const extensionTitle = extension.localIdentifier
  const extensionType = extension.type

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

  return args
}

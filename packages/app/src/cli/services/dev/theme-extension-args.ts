import {ThemeExtension} from '../../models/app/extensions.js'
import {ensureThemeExtensionDevContext} from '../context.js'

export async function themeExtensionArgs(
  extension: ThemeExtension,
  apiKey: string,
  token: string,
  options: {theme?: string; themeExtensionPort?: number; generateTmpTheme?: boolean},
) {
  const extensionRegistration = await ensureThemeExtensionDevContext(extension, apiKey, token)
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

  return args
}

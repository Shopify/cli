import {AppInterface} from '../../models/app/app.js'
import {ThemeExtension} from '../../models/app/extensions.js'
import {ensureDeployEnvironment} from '../environment.js'

export async function themeExtensionArgs(
  extension: ThemeExtension,
  apiKey: string,
  options: {app: AppInterface; theme?: string; themeExtensionPort?: number; reset: boolean},
) {
  const {identifiers} = await ensureDeployEnvironment(options)

  const directory = extension.directory
  const extensionId = identifiers.extensionIds[extension.localIdentifier]!
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

  return args
}

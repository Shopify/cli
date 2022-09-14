import {AppInterface} from '../../models/app/app.js'
import {ensureDeployEnvironment} from '../environment.js'

export async function themeExtensionArgs(
  apiKey: string,
  options: {app: AppInterface; theme?: string; port?: number; reset: boolean},
) {
  const {identifiers} = await ensureDeployEnvironment(options)

  const extension = options.app.extensions.theme[0]!

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

  if (options.port) {
    args.push('--port', options.port.toString())
  }

  return args
}

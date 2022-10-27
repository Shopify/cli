import {ensureFunctionsIds} from './identifiers-functions.js'
import {ensureExtensionsIds} from './identifiers-extensions.js'
import {AppInterface} from '../../models/app/app.js'
import {Identifiers, IdentifiersExtensions} from '../../models/app/identifiers.js'
import {fetchAppExtensionRegistrations} from '../dev/fetch.js'
import {ExtensionTypes} from '../../constants.js'
import {output, error, environment} from '@shopify/cli-kit'
import {PackageManager} from '@shopify/cli-kit/node/node-package-manager'

export interface EnsureDeploymentIdsPresenceOptions {
  app: AppInterface
  token: string
  appId: string
  appName: string
  envIdentifiers: Partial<Identifiers>
}

export interface RemoteSource {
  uuid: string
  type: string
  id: string
  title: string
}

export interface LocalSource {
  localIdentifier: string
  graphQLType: string
  type: ExtensionTypes
  configuration: {name: string}
}

export type MatchingError = 'pending-remote' | 'invalid-environment' | 'user-cancelled'

export async function ensureDeploymentIdsPresence(options: EnsureDeploymentIdsPresenceOptions) {
  // We need local extensions to deploy
  if (!options.app.hasExtensions()) return {app: options.appId, extensions: {}, extensionIds: {}}

  const remoteSpecifications = await fetchAppExtensionRegistrations({token: options.token, apiKey: options.appId})

  let functions: IdentifiersExtensions
  if (environment.local.useFunctionMatching()) {
    const result = await ensureFunctionsIds(options, remoteSpecifications.app.functions)
    if (result.isErr()) throw handleIdsError(result.error, options.appName, options.app.packageManager)
    functions = result.value
  } else {
    functions = unmatchedFunctionIdentifiers(options)
  }

  const extensions = await ensureExtensionsIds(options, remoteSpecifications.app.extensionRegistrations)
  if (extensions.isErr()) throw handleIdsError(extensions.error, options.appName, options.app.packageManager)

  return {
    app: options.appId,
    extensions: {...functions, ...extensions.value.extensions},
    extensionIds: extensions.value.extensionIds,
  }
}

function unmatchedFunctionIdentifiers(options: EnsureDeploymentIdsPresenceOptions) {
  const validIdentifiers = options.envIdentifiers.extensions ?? {}
  const functionLocalIdentifiers: IdentifiersExtensions = Object.fromEntries(
    options.app.extensions.function
      .map((extension) => extension.localIdentifier)
      .map((extensionIdentifier) => {
        return validIdentifiers[extensionIdentifier]
          ? [extensionIdentifier, validIdentifiers[extensionIdentifier]]
          : undefined
      })
      .filter((entry) => entry !== undefined) as string[][],
  )
  return functionLocalIdentifiers
}

function handleIdsError(errorType: MatchingError, appName: string, packageManager: PackageManager) {
  switch (errorType) {
    case 'pending-remote':
    case 'invalid-environment':
      throw new error.Abort(
        `Deployment failed because this local project doesn't seem to match the app "${appName}" in Shopify Partners.`,
        `If you didn't intend to select this app, run ${
          output.content`${output.token.packagejsonScript(packageManager, 'deploy', '--reset')}`.value
        }
• If this is the app you intended, check your local project and make sure
  it contains the same number and types of extensions as the Shopify app
  you've selected. You may need to generate missing extensions.`,
      )
    case 'user-cancelled':
      throw new error.AbortSilent()
  }
}

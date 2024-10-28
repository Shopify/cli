import {LocalSource, RemoteSource} from '../context/identifiers.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {getExtensionIds, LocalRemoteSource} from '../context/id-matching.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {MigrateAppModuleSchema, MigrateAppModuleVariables} from '../../api/graphql/extension_migrate_app_module.js'
import {MAX_EXTENSION_HANDLE_LENGTH} from '../../models/extensions/schemas.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {slugify} from '@shopify/cli-kit/common/string'

export function getPaymentModulesToMigrate(
  localSources: LocalSource[],
  remoteSources: RemoteSource[],
  identifiers: IdentifiersExtensions,
) {
  const paymentsMap = new Map<string, string[]>([
    [
      'payments_extension',
      [
        'payments_app',
        'payments_app_credit_card',
        'payments_app_custom_credit_card',
        'payments_app_custom_onsite',
        'payments_app_redeemable',
      ],
    ],
  ])

  return getModulesToMigrate(localSources, remoteSources, identifiers, paymentsMap)
}

export function getFlowExtensionsToMigrate(
  localSources: LocalSource[],
  remoteSources: RemoteSource[],
  identifiers: IdentifiersExtensions,
) {
  const flowMap = new Map<string, string[]>([
    ['flow_action', ['flow_action_definition']],
    ['flow_trigger', ['flow_trigger_definition']],
  ])

  return getModulesToMigrate(localSources, remoteSources, identifiers, flowMap)
}

export function getUIExtensionsToMigrate(
  localSources: LocalSource[],
  remoteSources: RemoteSource[],
  identifiers: IdentifiersExtensions,
) {
  const uiMap = new Map<string, string[]>([['ui_extension', ['CHECKOUT_UI_EXTENSION', 'POS_UI_EXTENSION']]])
  return getModulesToMigrate(localSources, remoteSources, identifiers, uiMap)
}

export function getMarketingActivityExtensionsToMigrate(
  localSources: LocalSource[],
  remoteSources: RemoteSource[],
  identifiers: IdentifiersExtensions,
) {
  const marketingMap = new Map<string, string[]>([['marketing_activity', ['marketing_activity_extension']]])
  return getModulesToMigrate(localSources, remoteSources, identifiers, marketingMap)
}

/**
 * Returns a list of local and remote extensions that need to be migrated.
 *
 * Generic method not be used directly, create a specific method for each type of extension above.
 *
 * @param localSources - The local extensions to migrate.
 * @param remoteSources - The remote extensions to migrate.
 * @param identifiers - The identifiers for the extensions.
 * @param typesMap - A map of extension types to migrate.
 * @returns A list of local and remote extensions that need to be migrated.
 */
function getModulesToMigrate(
  localSources: LocalSource[],
  remoteSources: RemoteSource[],
  identifiers: IdentifiersExtensions,
  typesMap: Map<string, string[]>,
) {
  const ids = getExtensionIds(localSources, identifiers)
  const localExtensionTypesToMigrate = Array.from(typesMap.keys())
  const remoteExtensionTypesToMigrate = Array.from(typesMap.values()).flat()

  const local = localSources.filter((source) => localExtensionTypesToMigrate.includes(source.type))
  const remote = remoteSources.filter((source) => remoteExtensionTypesToMigrate.includes(source.type))

  // Map remote sources by uuid and slugified title (the slugified title is used for matching with local folder)
  const remoteSourcesMap = new Map<string, RemoteSource>()
  remote.forEach((remoteSource) => {
    remoteSourcesMap.set(remoteSource.uuid, remoteSource)
    remoteSourcesMap.set(slugify(remoteSource.title.substring(0, MAX_EXTENSION_HANDLE_LENGTH)), remoteSource)
  })

  return local.reduce<LocalRemoteSource[]>((accumulator, localSource) => {
    const localSourceId = ids[localSource.localIdentifier] ?? 'unknown'
    const remoteSource = remoteSourcesMap.get(localSourceId) ?? remoteSourcesMap.get(localSource.localIdentifier)
    const typeMatch = typesMap.get(localSource.type)?.includes(remoteSource?.type ?? 'undefined')

    if (remoteSource && typeMatch) {
      accumulator.push({local: localSource, remote: remoteSource})
    }
    return accumulator
  }, [])
}

export async function migrateAppModules(
  extensionsToMigrate: LocalRemoteSource[],
  appId: string,
  type: string,
  remoteExtensions: RemoteSource[],
  developerPlatformClient: DeveloperPlatformClient,
) {
  const migratedIDs = await Promise.all(
    extensionsToMigrate.map(({remote}) => migrateAppModule(appId, remote.id, type, developerPlatformClient)),
  )

  return remoteExtensions
    .filter((extension) => migratedIDs.includes(extension.id))
    .map((extension) => {
      return {
        ...extension,
        type: type.toUpperCase(),
      }
    })
}

async function migrateAppModule(
  apiKey: MigrateAppModuleVariables['apiKey'],
  registrationId: MigrateAppModuleVariables['registrationId'],
  type: MigrateAppModuleVariables['type'],
  developerPlatformClient: DeveloperPlatformClient,
) {
  const variables: MigrateAppModuleVariables = {
    apiKey,
    registrationId,
    type,
  }

  const result: MigrateAppModuleSchema = await developerPlatformClient.migrateAppModule(variables)

  if (result?.migrateAppModule?.userErrors?.length > 0) {
    const errors = result.migrateAppModule.userErrors.map((error) => error.message).join(', ')
    throw new AbortError(errors)
  }

  if (!result?.migrateAppModule?.migratedAppModule) {
    throw new AbortError(`Couldn't migrate to app module ${type}`)
  }

  return registrationId
}

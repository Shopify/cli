import {LocalSource, RemoteSource} from '../context/identifiers.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {getExtensionIds, LocalRemoteSource} from '../context/id-matching.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {MigrateAppModuleSchema, MigrateAppModuleVariables} from '../../api/graphql/extension_migrate_app_module.js'
import {MAX_EXTENSION_HANDLE_LENGTH} from '../../models/extensions/schemas.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {slugify} from '@shopify/cli-kit/common/string'

/**
 * All ***ModulesMap define the migration mapping between local and remote extension types.
 *
 * When adding new mappings, follow this rule in the mapping object:
 * - The key is the NEW type
 * - The value is an array of OLD types that can be migrated to the new type
 */
export const PaymentModulesMap = {
  payments_extension: [
    'payments_app',
    'payments_app_credit_card',
    'payments_app_custom_credit_card',
    'payments_app_custom_onsite',
    'payments_app_redeemable',
  ],
}

export const MarketingModulesMap = {
  marketing_activity: ['marketing_activity_extension'],
}

export const FlowModulesMap = {
  flow_action: ['flow_action_definition'],
  flow_trigger: ['flow_trigger_definition'],
  flow_trigger_lifecycle_callback: ['flow_trigger_discovery_webhook'],
}

export const UIModulesMap = {
  ui_extension: ['CHECKOUT_UI_EXTENSION', 'POS_UI_EXTENSION'],
}

export const SubscriptionModulesMap = {
  subscription_link_extension: ['subscription_link'],
}

export const AdminLinkModulesMap = {
  admin_link: ['app_link', 'bulk_action'],
}

/**
 * Returns a list of local and remote extensions that need to be migrated.
 *
 * @param localSources - The local extensions to migrate.
 * @param remoteSources - The remote extensions to migrate.
 * @param identifiers - The identifiers for the extensions.
 * @param typesMap - A map of extension types to migrate.
 * @returns A list of local and remote extensions that need to be migrated.
 */
export function getModulesToMigrate(
  localSources: LocalSource[],
  remoteSources: RemoteSource[],
  identifiers: IdentifiersExtensions,
  typesMap: {[key: string]: string[]},
) {
  const ids = getExtensionIds(localSources, identifiers)
  const localExtensionTypesToMigrate = Object.keys(typesMap)
  const remoteExtensionTypesToMigrate = Object.values(typesMap).flat()

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
    const remoteSource =
      remoteSourcesMap.get(localSourceId) ?? remoteSourcesMap.get(localSource.localIdentifier.toLowerCase())
    const typeMatch = typesMap[localSource.type]?.includes(remoteSource?.type ?? 'undefined')

    if (remoteSource && typeMatch) {
      accumulator.push({local: localSource, remote: remoteSource})
    }
    return accumulator
  }, [])
}

export async function migrateAppModules(options: {
  extensionsToMigrate: LocalRemoteSource[]
  appId: string
  type: string
  remoteExtensions: RemoteSource[]
  migrationClient: DeveloperPlatformClient
}) {
  const {extensionsToMigrate, appId, type, remoteExtensions, migrationClient} = options

  const migratedIDs = await Promise.all(
    extensionsToMigrate.map(({remote}) =>
      migrateAppModule({
        apiKey: appId,
        registrationId: undefined,
        registrationUuid: remote.uuid,
        type,
        migrationClient,
      }),
    ),
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

async function migrateAppModule(options: {
  apiKey: MigrateAppModuleVariables['apiKey']
  registrationId: MigrateAppModuleVariables['registrationId']
  registrationUuid: MigrateAppModuleVariables['registrationUuid']
  type: MigrateAppModuleVariables['type']
  migrationClient: DeveloperPlatformClient
}) {
  const {apiKey, registrationId, registrationUuid, type, migrationClient} = options

  const variables: MigrateAppModuleVariables = {
    apiKey,
    registrationId,
    registrationUuid,
    type,
  }

  const result: MigrateAppModuleSchema = await migrationClient.migrateAppModule(variables)

  if (result?.migrateAppModule?.userErrors?.length > 0) {
    const errors = result.migrateAppModule.userErrors.map((error) => error.message).join(', ')
    throw new AbortError(errors)
  }

  if (!result?.migrateAppModule?.migratedAppModule) {
    throw new AbortError(`Couldn't migrate to app module ${type}`)
  }

  return registrationId
}

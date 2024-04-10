import {LocalSource, RemoteSource} from '../context/identifiers.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {getExtensionIds, LocalRemoteSource} from '../context/id-matching.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {MigrateAppModuleSchema, MigrateAppModuleVariables} from '../../api/graphql/extension_migrate_app_module.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {slugify} from '@shopify/cli-kit/common/string'

export function getPaymentsExtensionsToMigrate(
  localSources: LocalSource[],
  remoteSources: RemoteSource[],
  identifiers: IdentifiersExtensions,
) {
  const ids = getExtensionIds(localSources, identifiers)
  const localExtensionTypesToMigrate = ['payments_extension']
  const remoteExtensionTypesToMigrate = [
    'payments_app',
    'payments_app_credit_card',
    'payments_app_custom_credit_card',
    'payments_app_custom_onsite',
    'payments_app_redeemable',
  ]
  const typesMap = new Map<string, string[]>()
  typesMap.set('payments_extension', [
    'payments_app',
    'payments_app_credit_card',
    'payments_app_custom_credit_card',
    'payments_app_custom_onsite',
    'payments_app_redeemable',
  ])

  const local = localSources.filter((source) => localExtensionTypesToMigrate.includes(source.type))
  const remote = remoteSources.filter((source) => remoteExtensionTypesToMigrate.includes(source.type))

  // Map remote sources by uuid and slugified title (the slugified title is used for matching with local folder)
  const remoteSourcesMap = new Map<string, RemoteSource>()
  remote.forEach((remoteSource) => {
    remoteSourcesMap.set(remoteSource.uuid, remoteSource)
    remoteSourcesMap.set(slugify(remoteSource.title), remoteSource)
  })

  return local.reduce<LocalRemoteSource[]>((accumulator, localSource) => {
    const localSourceId = ids[localSource.localIdentifier] ?? 'unknown'
    const remoteSource = remoteSourcesMap.get(localSourceId) || remoteSourcesMap.get(localSource.localIdentifier)
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

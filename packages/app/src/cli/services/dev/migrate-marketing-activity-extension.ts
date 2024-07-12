import {LocalSource, RemoteSource} from '../context/identifiers.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {getExtensionIds, LocalRemoteSource} from '../context/id-matching.js'
import {
  MigrateMarketingActivityExtensionSchema,
  MigrateMarketingActivityExtensionVariables,
} from '../../api/graphql/extension_migrate_marketing_activity_extension.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {slugify} from '@shopify/cli-kit/common/string'

export function getMarketingActivtyExtensionsToMigrate(
  localSources: LocalSource[],
  remoteSources: RemoteSource[],
  identifiers: IdentifiersExtensions,
) {
  const ids = getExtensionIds(localSources, identifiers)
  const localExtensionTypesToMigrate = ['marketing_activity_extension_cli']
  const remoteExtensionTypesToMigrate = ['marketing_activity_extension']
  const typesMap = new Map<string, string>([['marketing_activity_extension_cli', 'marketing_activity_extension']])

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
    const typeMatch = typesMap.get(localSource.type) === remoteSource?.type

    if (remoteSource && typeMatch) {
      accumulator.push({local: localSource, remote: remoteSource})
    }
    return accumulator
  }, [])
}

export async function migrateMarketingActivityExtensions(
  extensionsToMigrate: LocalRemoteSource[],
  appId: string,
  remoteExtensions: RemoteSource[],
  developerPlatformClient: DeveloperPlatformClient,
) {
  const migratedIDs = await Promise.all(
    extensionsToMigrate.map(({remote}) => migrateMarketingActivityExtension(appId, remote.id, developerPlatformClient)),
  )

  const typesMap = new Map<string, string>([['marketing_activity_extension', 'MARKETING_ACTIVITY']])

  return remoteExtensions
    .filter((extension) => migratedIDs.includes(extension.id))
    .map((extension) => {
      return {
        ...extension,
        type: typesMap.get(extension.type) ?? extension.type,
      }
    })
}

async function migrateMarketingActivityExtension(
  apiKey: MigrateMarketingActivityExtensionVariables['apiKey'],
  registrationId: MigrateMarketingActivityExtensionVariables['registrationId'],
  developerPlatformClient: DeveloperPlatformClient,
) {
  const variables: MigrateMarketingActivityExtensionVariables = {
    apiKey,
    registrationId,
  }

  const result: MigrateMarketingActivityExtensionSchema =
    await developerPlatformClient.migrateMarketingActivityExtension(variables)

  if (result?.migrateMarketingActivityExtension?.userErrors?.length > 0) {
    const errors = result.migrateMarketingActivityExtension.userErrors.map((error) => error.message).join(', ')
    throw new AbortError(errors)
  }

  if (!result?.migrateMarketingActivityExtension?.migratedExtensionToCli) {
    throw new AbortError("Couldn't migrate to Marketing activity extension")
  }

  return registrationId
}

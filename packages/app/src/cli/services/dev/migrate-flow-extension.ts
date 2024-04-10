import {LocalSource, RemoteSource} from '../context/identifiers.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {getExtensionIds, LocalRemoteSource} from '../context/id-matching.js'
import {
  MigrateFlowExtensionSchema,
  MigrateFlowExtensionVariables,
} from '../../api/graphql/extension_migrate_flow_extension.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {slugify} from '@shopify/cli-kit/common/string'

export function getFlowExtensionsToMigrate(
  localSources: LocalSource[],
  remoteSources: RemoteSource[],
  identifiers: IdentifiersExtensions,
) {
  const ids = getExtensionIds(localSources, identifiers)
  const localExtensionTypesToMigrate = ['flow_action', 'flow_trigger']
  const remoteExtensionTypesToMigrate = ['flow_action_definition', 'flow_trigger_definition']
  const typesMap = new Map<string, string>([
    ['flow_action', 'flow_action_definition'],
    ['flow_trigger', 'flow_trigger_definition'],
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
    const typeMatch = typesMap.get(localSource.type) === remoteSource?.type

    if (remoteSource && typeMatch) {
      accumulator.push({local: localSource, remote: remoteSource})
    }
    return accumulator
  }, [])
}

export async function migrateFlowExtensions(
  extensionsToMigrate: LocalRemoteSource[],
  appId: string,
  remoteExtensions: RemoteSource[],
  developerPlatformClient: DeveloperPlatformClient,
) {
  const migratedIDs = await Promise.all(
    extensionsToMigrate.map(({remote}) => migrateFlowExtension(appId, remote.id, developerPlatformClient)),
  )

  const typesMap = new Map<string, string>([
    ['flow_action_definition', 'FLOW_ACTION'],
    ['flow_trigger_definition', 'FLOW_TRIGGER'],
  ])

  return remoteExtensions
    .filter((extension) => migratedIDs.includes(extension.id))
    .map((extension) => {
      return {
        ...extension,
        type: typesMap.get(extension.type) ?? extension.type,
      }
    })
}

async function migrateFlowExtension(
  apiKey: MigrateFlowExtensionVariables['apiKey'],
  registrationId: MigrateFlowExtensionVariables['registrationId'],
  developerPlatformClient: DeveloperPlatformClient,
) {
  const variables: MigrateFlowExtensionVariables = {
    apiKey,
    registrationId,
  }

  const result: MigrateFlowExtensionSchema = await developerPlatformClient.migrateFlowExtension(variables)

  if (result?.migrateFlowExtension?.userErrors?.length > 0) {
    const errors = result.migrateFlowExtension.userErrors.map((error) => error.message).join(', ')
    throw new AbortError(errors)
  }

  if (!result?.migrateFlowExtension?.migratedFlowExtension) {
    throw new AbortError("Couldn't migrate to Flow extension")
  }

  return registrationId
}

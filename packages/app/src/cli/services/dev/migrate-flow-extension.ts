import {RemoteSource} from '../context/identifiers.js'
import {LocalRemoteSource} from '../context/id-matching.js'
import {
  MigrateFlowExtensionSchema,
  MigrateFlowExtensionVariables,
} from '../../api/graphql/extension_migrate_flow_extension.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AbortError} from '@shopify/cli-kit/node/error'

export async function migrateFlowExtensions(options: {
  extensionsToMigrate: LocalRemoteSource[]
  appId: string
  remoteExtensions: RemoteSource[]
  migrationClient: DeveloperPlatformClient
}) {
  const {extensionsToMigrate, appId, remoteExtensions, migrationClient} = options

  const migratedIDs = await Promise.all(
    extensionsToMigrate.map(({remote}) =>
      migrateFlowExtension({
        apiKey: appId,
        registrationId: undefined,
        registrationUuid: remote.uuid,
        migrationClient,
      }),
    ),
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

async function migrateFlowExtension(options: {
  apiKey: MigrateFlowExtensionVariables['apiKey']
  registrationId: MigrateFlowExtensionVariables['registrationId']
  registrationUuid: MigrateFlowExtensionVariables['registrationUuid']
  migrationClient: DeveloperPlatformClient
}) {
  const {apiKey, registrationId, registrationUuid, migrationClient} = options

  const variables: MigrateFlowExtensionVariables = {
    apiKey,
    registrationId,
    registrationUuid,
  }

  const result: MigrateFlowExtensionSchema = await migrationClient.migrateFlowExtension(variables)

  if (result?.migrateFlowExtension?.userErrors?.length > 0) {
    const errors = result.migrateFlowExtension.userErrors.map((error) => error.message).join(', ')
    throw new AbortError(errors)
  }

  if (!result?.migrateFlowExtension?.migratedFlowExtension) {
    throw new AbortError("Couldn't migrate to Flow extension")
  }

  return registrationId
}

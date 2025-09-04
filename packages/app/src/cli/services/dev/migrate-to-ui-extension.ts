import {
  MigrateToUiExtensionSchema,
  MigrateToUiExtensionVariables,
} from '../../api/graphql/extension_migrate_to_ui_extension.js'
import {RemoteSource} from '../context/identifiers.js'
import {LocalRemoteSource} from '../context/id-matching.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AbortError} from '@shopify/cli-kit/node/error'

export async function migrateExtensionsToUIExtension(options: {
  extensionsToMigrate: LocalRemoteSource[]
  appId: string
  remoteExtensions: RemoteSource[]
  migrationClient: DeveloperPlatformClient
}) {
  const {extensionsToMigrate, appId, remoteExtensions, migrationClient} = options

  await Promise.all(
    extensionsToMigrate.map(({remote}) =>
      migrateExtensionToUIExtension({
        apiKey: appId,
        registrationId: undefined,
        registrationUuid: remote.uuid,
        migrationClient,
      }),
    ),
  )

  return remoteExtensions.map((extension) => {
    if (extensionsToMigrate.some(({remote}) => remote.uuid === extension.uuid)) {
      return {
        ...extension,
        type: 'UI_EXTENSION',
      }
    }
    return extension
  })
}

async function migrateExtensionToUIExtension(options: {
  apiKey: MigrateToUiExtensionVariables['apiKey']
  registrationId: MigrateToUiExtensionVariables['registrationId']
  registrationUuid: MigrateToUiExtensionVariables['registrationUuid']
  migrationClient: DeveloperPlatformClient
}) {
  const {apiKey, registrationId, registrationUuid, migrationClient} = options

  const variables: MigrateToUiExtensionVariables = {
    apiKey,
    registrationId,
    registrationUuid,
  }

  const result: MigrateToUiExtensionSchema = await migrationClient.migrateToUiExtension(variables)

  if (result?.migrateToUiExtension?.userErrors?.length > 0) {
    const errors = result.migrateToUiExtension.userErrors.map((error) => error.message).join(', ')
    throw new AbortError(errors)
  }

  if (!result?.migrateToUiExtension?.migratedToUiExtension) {
    throw new AbortError("Couldn't migrate to UI extension")
  }
}

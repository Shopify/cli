import {
  MigrateToUiExtensionSchema,
  MigrateToUiExtensionVariables,
} from '../../api/graphql/extension_migrate_to_ui_extension.js'
import {RemoteSource} from '../context/identifiers.js'
import {LocalRemoteSource} from '../context/id-matching.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AbortError} from '@shopify/cli-kit/node/error'

export async function migrateExtensionsToUIExtension(
  extensionsToMigrate: LocalRemoteSource[],
  appId: string,
  remoteExtensions: RemoteSource[],
  developerPlatformClient: DeveloperPlatformClient,
) {
  await Promise.all(
    extensionsToMigrate.map(({remote}) => migrateExtensionToUIExtension(appId, remote.id, developerPlatformClient)),
  )

  return remoteExtensions.map((extension) => {
    if (extensionsToMigrate.some(({remote}) => remote.id === extension.id)) {
      return {
        ...extension,
        type: 'UI_EXTENSION',
      }
    }
    return extension
  })
}

async function migrateExtensionToUIExtension(
  apiKey: MigrateToUiExtensionVariables['apiKey'],
  registrationId: MigrateToUiExtensionVariables['registrationId'],
  developerPlatformClient: DeveloperPlatformClient,
) {
  const variables: MigrateToUiExtensionVariables = {
    apiKey,
    registrationId,
  }

  const result: MigrateToUiExtensionSchema = await developerPlatformClient.migrateToUiExtension(variables)

  if (result?.migrateToUiExtension?.userErrors?.length > 0) {
    const errors = result.migrateToUiExtension.userErrors.map((error) => error.message).join(', ')
    throw new AbortError(errors)
  }

  if (!result?.migrateToUiExtension?.migratedToUiExtension) {
    throw new AbortError("Couldn't migrate to UI extension")
  }
}

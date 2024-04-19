import {
  MigrateToUiExtensionSchema,
  MigrateToUiExtensionVariables,
} from '../../api/graphql/extension_migrate_to_ui_extension.js'
import {LocalSource, RemoteSource} from '../context/identifiers.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {getExtensionIds, LocalRemoteSource} from '../context/id-matching.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {slugify} from '@shopify/cli-kit/common/string'

export function getUIExtensionsToMigrate(
  localSources: LocalSource[],
  remoteSources: RemoteSource[],
  identifiers: IdentifiersExtensions,
) {
  const ids = getExtensionIds(localSources, identifiers)
  const remoteExtensionTypesToMigrate = ['CHECKOUT_UI_EXTENSION']

  return localSources.reduce<LocalRemoteSource[]>((accumulator, localSource) => {
    if (localSource.type === 'ui_extension') {
      const remoteSource = remoteSources.find((source) => {
        const matchesId = source.uuid === ids[localSource.localIdentifier]
        const matchesTitle = slugify(source.title) === slugify(localSource.handle)

        return matchesId || matchesTitle
      })

      if (!remoteSource) {
        return accumulator
      }

      const typeIsToMigrate = remoteExtensionTypesToMigrate.includes(remoteSource.type)

      if (typeIsToMigrate) {
        accumulator.push({local: localSource, remote: remoteSource})
      }
    }

    return accumulator
  }, [])
}

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

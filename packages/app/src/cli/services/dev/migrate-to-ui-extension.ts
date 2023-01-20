import {
  ExtensionMigrateToUiExtensionQuery,
  ExtensionMigrateToUiExtensionSchema,
  ExtensionMigrateToUiExtensionVariables,
} from '../../api/graphql/extension_migrate_to_ui_extension.js'
import {LocalSource, RemoteSource} from '../environment/identifiers.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {getExtensionIds, LocalRemoteSource} from '../environment/id-matching.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {error} from '@shopify/cli-kit'

export function getExtensionsToMigrate(
  localSources: LocalSource[],
  remoteSources: RemoteSource[],
  identifiers: IdentifiersExtensions,
) {
  const ids = getExtensionIds(localSources, identifiers)
  const remoteExtensionTypesToMigrate = ['CHECKOUT_UI_EXTENSION']

  return localSources.reduce<LocalRemoteSource[]>((accumulator, localSource) => {
    if (localSource.type === 'ui_extension') {
      const remoteSource = remoteSources.find((source) => {
        const matchesId = source.uuid === ids[localSource.configuration.name]
        const matchesTitle = source.title === localSource.configuration.name

        return matchesId || matchesTitle
      })

      if (!remoteSource) {
        return accumulator
      }

      const typeMimatches = remoteSource.type !== localSource.type
      const typeIsToMigrate = remoteExtensionTypesToMigrate.includes(remoteSource.type)

      if (typeMimatches && typeIsToMigrate) {
        accumulator.push({local: localSource, remote: remoteSource})
      }
    }

    return accumulator
  }, [])
}

export async function migrateToUiExtension(
  apiKey: ExtensionMigrateToUiExtensionVariables['apiKey'],
  registrationId: ExtensionMigrateToUiExtensionVariables['registrationId'],
) {
  const token = await ensureAuthenticatedPartners()
  const query = ExtensionMigrateToUiExtensionQuery
  const variables: ExtensionMigrateToUiExtensionVariables = {
    apiKey,
    registrationId,
  }

  const result: ExtensionMigrateToUiExtensionSchema = await partnersRequest(query, token, variables)

  if (result?.migrateToUiExtension?.userErrors?.length > 0) {
    const errors = result.migrateToUiExtension.userErrors.map((error) => error.message).join(', ')
    throw new error.Abort(errors)
  }

  if (!result?.migrateToUiExtension?.migratedToUiExtension) {
    throw new error.Abort("Couldn't migrate to UI extension")
  }
}

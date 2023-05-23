import {
  ExtensionMigrateFlowExtensionQuery,
  ExtensionMigrateFlowExtensionSchema,
  ExtensionMigrateFlowExtensionVariables,
} from '../../api/graphql/extension_migrate_flow_extension.js'
import {LocalSource, RemoteSource} from '../context/identifiers.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {getExtensionIds, LocalRemoteSource} from '../context/id-matching.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'

export function getExtensionsToMigrate(
  localSources: LocalSource[],
  remoteSources: RemoteSource[],
  identifiers: IdentifiersExtensions,
) {
  const ids = getExtensionIds(localSources, identifiers)
  const remoteExtensionTypesToMigrate = ['FLOW_ACTION_DEFINITION']

  return localSources.reduce<LocalRemoteSource[]>((accumulator, localSource) => {
    if (localSource.type === 'flow_action_definition_prototype') {
      const remoteSource = remoteSources.find((source) => {
        const matchesId = source.uuid === ids[localSource.configuration.name]
        const matchesTitle = source.title === localSource.configuration.name

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

export async function migrateFlowExtensions(
  extensionsToMigrate: LocalRemoteSource[],
  appId: string,
  remoteExtensions: RemoteSource[],
) {
  await Promise.all(extensionsToMigrate.map(({remote}) => migrateFlowExtension(appId, remote.id)))

  return remoteExtensions.map((extension) => {
    if (extensionsToMigrate.some(({remote}) => remote.id === extension.id)) {
      return {
        ...extension,
        type: 'FLOW_ACTION_DEFINITION_PROTOTYPE',
      }
    }
    return extension
  })
}

export async function migrateFlowExtension(
  apiKey: ExtensionMigrateFlowExtensionVariables['apiKey'],
  registrationId: ExtensionMigrateFlowExtensionVariables['registrationId'],
) {
  const token = await ensureAuthenticatedPartners()
  const variables: ExtensionMigrateFlowExtensionVariables = {
    apiKey,
    registrationId,
  }

  const result: ExtensionMigrateFlowExtensionSchema = await partnersRequest(
    ExtensionMigrateFlowExtensionQuery,
    token,
    variables,
  )

  if (result?.migrateFlowExtension?.userErrors?.length > 0) {
    const errors = result.migrateFlowExtension.userErrors.map((error) => error.message).join(', ')
    throw new AbortError(errors)
  }

  if (!result?.migrateFlowExtension?.migratedFlowExtension) {
    throw new AbortError("Couldn't migrate to UI extension")
  }
}

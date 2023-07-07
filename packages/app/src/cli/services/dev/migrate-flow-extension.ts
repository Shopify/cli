import {LocalSource, RemoteSource} from '../context/identifiers.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {getExtensionIds, LocalRemoteSource} from '../context/id-matching.js'
import {
  MigrateFlowExtensionMutation,
  MigrateFlowExtensionSchema,
  MigrateFlowExtensionVariables,
} from '../../api/graphql/extension_migrate_flow_extension.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'

export function getFlowExtensionsToMigrate(
  localSources: LocalSource[],
  remoteSources: RemoteSource[],
  identifiers: IdentifiersExtensions,
) {
  const ids = getExtensionIds(localSources, identifiers)
  const remoteExtensionTypesToMigrate = ['flow_action_definition', 'flow_trigger_definition']

  return localSources.reduce<LocalRemoteSource[]>((accumulator, localSource) => {
    if (localSource.type === 'flow_action' || localSource.type === 'flow_trigger') {
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
      const newType = extension.type === 'flow_action_definition' ? 'FLOW_ACTION' : 'FLOW_TRIGGER'
      return {
        ...extension,
        type: newType,
      }
    }
    return extension
  })
}

export async function migrateFlowExtension(
  apiKey: MigrateFlowExtensionVariables['apiKey'],
  registrationId: MigrateFlowExtensionVariables['registrationId'],
) {
  const token = await ensureAuthenticatedPartners()
  const variables: MigrateFlowExtensionVariables = {
    apiKey,
    registrationId,
  }

  const result: MigrateFlowExtensionSchema = await partnersRequest(MigrateFlowExtensionMutation, token, variables)

  if (result?.migrateFlowExtension?.userErrors?.length > 0) {
    const errors = result.migrateFlowExtension.userErrors.map((error) => error.message).join(', ')
    throw new AbortError(errors)
  }

  if (!result?.migrateFlowExtension?.migratedFlowExtension) {
    throw new AbortError("Couldn't migrate to Flow extension")
  }
}

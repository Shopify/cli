import {LocalSource, RemoteSource} from '../context/identifiers.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {getExtensionIds, LocalRemoteSource} from '../context/id-matching.js'
import {slugify} from '@shopify/cli-kit/common/string'

export function getMarketingActivtyExtensionsToMigrate(
  localSources: LocalSource[],
  remoteSources: RemoteSource[],
  identifiers: IdentifiersExtensions,
) {
  const ids = getExtensionIds(localSources, identifiers)
  const localExtensionTypesToMigrate = ['marketing_activity']
  const remoteExtensionTypesToMigrate = ['marketing_activity_extension']
  const typesMap = new Map<string, string>([['marketing_activity', 'marketing_activity_extension']])

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

import {selectRemoteSourcePrompt} from './prompts.js'
import {LocalSource, RemoteSource} from './identifiers.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'

export type ManualMatchResult =
  | {
      result: 'ok'
      identifiers: IdentifiersExtensions
      toCreate: LocalSource[]
    }
  | {result: 'pending-remote'}

/**
 * Prompt the user to manually match each of the local sources to a remote source.
 * Sources can either be extensions or functions.
 *
 * The user can also select to create a new remote source instead of selecting an existing one.
 * Manual matching will only show sources of the same type as possible matches.
 * At the end of this process, all remote sources must be matched with the local sources to succeed.
 *
 * @param local - The local sources to match
 * @param remote - The remote sources to match
 * @returns The result of the manual matching
 */
export async function manualMatchIds(
  options: {
    local: LocalSource[]
    remote: RemoteSource[]
  },
  remoteIdField: 'id' | 'uuid',
): Promise<ManualMatchResult> {
  const identifiers: {[key: string]: string} = {}
  let pendingRemote = options.remote
  let pendingLocal = options.local

  for (const currentLocal of options.local) {
    const remoteSourcesOfSameType = pendingRemote.filter(
      (remoteSource) => remoteSource.type === currentLocal.graphQLType,
    )
    if (remoteSourcesOfSameType.length === 0) continue
    // eslint-disable-next-line no-await-in-loop
    const selected = await selectRemoteSourcePrompt(currentLocal, remoteSourcesOfSameType, remoteIdField)
    if (!selected) continue

    identifiers[currentLocal.localIdentifier] = selected[remoteIdField]
    pendingRemote = pendingRemote.filter((remote) => remote[remoteIdField] !== selected[remoteIdField])
    pendingLocal = pendingLocal.filter((local) => local.localIdentifier !== currentLocal.localIdentifier)
  }

  if (pendingRemote.length > 0) {
    return {result: 'pending-remote'}
  } else {
    return {result: 'ok', identifiers, toCreate: pendingLocal}
  }
}

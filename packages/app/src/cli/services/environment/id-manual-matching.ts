import {selectRegistrationPrompt} from './prompts.js'
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
 * Prompt the user to manually match each of the local extensions to a remote extension.
 * The user can also select to create a new remote extension instead of selecting an existing one.
 * Manual matching will only show extensions of the same type as possible matches.
 * At the end of this process, all remote extensions must be matched to suceed.
 * @param local - The local extensions to match
 * @param remote - The remote extensions to match
 * @returns The result of the manual matching
 */
export async function manualMatchIds(
  options: {
    local: LocalSource[]
    remote: RemoteSource[]
  },
  registrationIdField: 'id' | 'uuid',
): Promise<ManualMatchResult> {
  const identifiers: {[key: string]: string} = {}
  let pendingRemote = options.remote
  let pendingLocal = options.local
  const idField = registrationIdField
  for (const extension of options.local) {
    const registrationsForType = pendingRemote.filter((reg) => reg.type === extension.graphQLType)
    if (registrationsForType.length === 0) continue
    // eslint-disable-next-line no-await-in-loop
    const selected = await selectRegistrationPrompt(extension, registrationsForType, idField)
    if (!selected) continue

    identifiers[extension.localIdentifier] = selected[idField]
    pendingRemote = pendingRemote.filter((reg) => reg[idField] !== selected[idField])
    pendingLocal = pendingLocal.filter((reg) => reg.localIdentifier !== extension.localIdentifier)
  }

  if (pendingRemote.length > 0) return {result: 'pending-remote'}
  return {result: 'ok', identifiers, toCreate: pendingLocal}
}

import {ExtensionRegistration} from '../dev/create-extension'
import {Extension, IdentifiersExtensions} from 'cli/models/app/app'
import {ui} from '@shopify/cli-kit'

export type ManualMatchResult =
  | {
      result: 'ok'
      identifiers: IdentifiersExtensions
      idIdentifiers: IdentifiersExtensions
      toCreate: Extension[]
    }
  | {result: 'pending-remote'}

/**
 * Prompt the user to manually match each of the local extensions to a remote extension.
 * The user can also select to create a new remote extension instead of selecting an existing one.
 * Manual matching will only show extensions of the same type as possible matches.
 * At the end of this process, all remote extensions must be matched to suceed.
 * @param localExtensions {Extension[]} The local extensions to match
 * @param remoteExtensions {ExtensionRegistration[]} The remote extensions to match
 * @returns {Promise<ManualMatchResult>} The result of the manual matching
 */
export async function manualMatchIds(
  localExtensions: Extension[],
  remoteExtensions: ExtensionRegistration[],
): Promise<ManualMatchResult> {
  const identifiers: {[key: string]: string} = {}
  const idIdentifiers: {[key: string]: string} = {}
  let pendingRemote = remoteExtensions
  let pendingLocal = localExtensions
  for (const extension of localExtensions) {
    const registrationsForType = pendingRemote.filter((reg) => reg.type === extension.graphQLType)
    if (registrationsForType.length === 0) continue
    // eslint-disable-next-line no-await-in-loop
    const selected = await selectRegistrationPrompt(extension, registrationsForType)
    if (!selected) continue

    identifiers[extension.localIdentifier] = selected.uuid
    idIdentifiers[extension.localIdentifier] = selected.id
    pendingRemote = pendingRemote.filter((reg) => reg.uuid !== selected.uuid)
    pendingLocal = pendingLocal.filter((reg) => reg.localIdentifier !== extension.localIdentifier)
  }

  if (pendingRemote.length > 0) return {result: 'pending-remote'}
  return {result: 'ok', identifiers, idIdentifiers, toCreate: pendingLocal}
}

export async function selectRegistrationPrompt(
  extension: Extension,
  registrations: ExtensionRegistration[],
): Promise<ExtensionRegistration> {
  const registrationList = registrations.map((reg) => ({
    name: `Match it to ${reg.title} (ID: ${reg.id} on Shopify Partners)`,
    value: reg.uuid,
  }))
  registrationList.push({name: 'Create new extension', value: 'create'})
  const questions: ui.Question = {
    type: 'autocomplete',
    name: 'uuid',
    message: `How would you like to deploy your "${extension.localIdentifier}"?`,
    choices: registrationList,
  }
  const choice: {uuid: string} = await ui.prompt([questions])
  return registrations.find((reg) => reg.uuid === choice.uuid)!
}

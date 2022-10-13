import {ExtensionRegistration} from '../dev/create-extension.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {Extension} from '../../models/app/extensions.js'
import {ui} from '@shopify/cli-kit'
import {LocalExtension} from './id-matching.js'

export type ManualMatchResult =
  | {
      result: 'ok'
      identifiers: IdentifiersExtensions
      toCreate: LocalExtension[]
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
export async function manualMatchIds(options: {
  local: LocalExtension[]
  remote: ExtensionRegistration[]
}): Promise<ManualMatchResult> {
  const identifiers: {[key: string]: string} = {}
  let pendingRemote = options.remote
  let pendingLocal = options.local
  for (const extension of options.local) {
    const registrationsForType = pendingRemote.filter((reg) => reg.type === extension.graphQLType)
    if (registrationsForType.length === 0) continue
    // eslint-disable-next-line no-await-in-loop
    const selected = await selectRegistrationPrompt(extension, registrationsForType)
    if (!selected) continue

    identifiers[extension.localIdentifier] = selected.uuid
    pendingRemote = pendingRemote.filter((reg) => reg.uuid !== selected.uuid)
    pendingLocal = pendingLocal.filter((reg) => reg.localIdentifier !== extension.localIdentifier)
  }

  if (pendingRemote.length > 0) return {result: 'pending-remote'}
  return {result: 'ok', identifiers, toCreate: pendingLocal}
}

export async function selectRegistrationPrompt(
  extension: LocalExtension,
  registrations: ExtensionRegistration[],
): Promise<ExtensionRegistration> {
  const registrationList = registrations.map((reg) => ({
    name: `Match it to ${reg.title} (ID: ${reg.id} on Shopify Partners)`,
    value: reg.uuid,
  }))
  registrationList.push({name: 'Create new extension', value: 'create'})
  const choice: {uuid: string} = await ui.prompt([
    {
      type: 'autocomplete',
      name: 'uuid',
      message: `How would you like to deploy your "${extension.localIdentifier}"?`,
      choices: registrationList,
    },
  ])
  return registrations.find((reg) => reg.uuid === choice.uuid)!
}

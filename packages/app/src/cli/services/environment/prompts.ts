import {LocalSource, RemoteSource} from './identifiers.js'
import {ExtensionRegistration} from '../dev/create-extension.js'
import {ui} from '@shopify/cli-kit'

export async function matchConfirmationPrompt(extension: LocalSource, registration: ExtensionRegistration) {
  const choices = [
    {name: `Yes, that's right`, value: 'yes'},
    {name: `No, cancel deployment`, value: 'no'},
  ]
  const choice: {value: string} = await ui.prompt([
    {
      type: 'select',
      name: 'value',
      message: `Deploy ${extension.configuration.name} (local name) as ${registration.title} (name on Shopify Partners, ID: ${registration.id})?`,
      choices,
    },
  ])
  return choice.value === 'yes'
}

export async function selectRemoteSourcePrompt(
  localSource: LocalSource,
  remoteSourcesOfSameType: RemoteSource[],
  remoteIdField: 'id' | 'uuid',
): Promise<RemoteSource> {
  const remoteOptions = remoteSourcesOfSameType.map((remote) => ({
    name: `Match it to ${remote.title} (ID: ${remote.id} on Shopify Partners)`,
    value: remote[remoteIdField],
  }))
  remoteOptions.push({name: 'Create new extension', value: 'create'})
  const choice: {uuid: string} = await ui.prompt([
    {
      type: 'autocomplete',
      name: 'uuid',
      message: `How would you like to deploy your "${localSource.configuration.name}"?`,
      choices: remoteOptions,
    },
  ])
  return remoteSourcesOfSameType.find((remote) => remote[remoteIdField] === choice.uuid)!
}

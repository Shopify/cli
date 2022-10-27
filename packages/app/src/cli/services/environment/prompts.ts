import {LocalSource, RemoteSource} from './identifiers.js'
import {ui} from '@shopify/cli-kit'

export async function matchConfirmationPrompt(local: LocalSource, remote: RemoteSource) {
  const choices = [
    {name: `Yes, that's right`, value: 'yes'},
    {name: `No, cancel deployment`, value: 'no'},
  ]
  const choice: {value: string} = await ui.prompt([
    {
      type: 'select',
      name: 'value',
      message: `Deploy ${local.configuration.name} (local name) as ${remote.title} (name on Shopify Partners, ID: ${remote.id})?`,
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

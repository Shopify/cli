import {LocalSource, RemoteSource} from './identifiers.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {ui} from '@shopify/cli-kit'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'

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

interface SourceSummary {
  question: string
  identifiers: IdentifiersExtensions
  toCreate: LocalSource[]
  onlyRemote: RemoteSource[]
}

export async function deployConfirmationPrompt(summary: SourceSummary): Promise<boolean> {
  const infoTable: {[key: string]: string[]} = {}

  if (summary.toCreate.length > 0) {
    infoTable.add = summary.toCreate.map((source) => source.localIdentifier)
  }

  const toUpdate = Object.keys(summary.identifiers)

  if (toUpdate.length > 0) {
    infoTable.update = toUpdate
  }

  if (summary.onlyRemote.length > 0) {
    infoTable['missing locally'] = summary.onlyRemote.map((source) => source.title)
  }

  if (Object.keys(infoTable).length === 0) {
    return new Promise((resolve) => resolve(true))
  }

  return renderSelectPrompt({
    message: summary.question,
    choices: [
      {label: 'Yes, deploy to push changes', value: true, key: 'y'},
      {label: 'No, cancel', value: false, key: 'n'},
    ],
    infoTable,
  })
}

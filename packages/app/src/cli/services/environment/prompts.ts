import {LocalSource, RemoteSource} from './identifiers.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {renderAutocompletePrompt, renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'

export async function matchConfirmationPrompt(local: LocalSource, remote: RemoteSource) {
  return renderConfirmationPrompt({
    message: `Deploy ${local.configuration.name} (local name) as ${remote.title} (name on Shopify Partners, ID: ${remote.id})?`,
    confirmationMessage: `Yes, that's right`,
    cancellationMessage: `No, cancel deployment`,
  })
}

export async function selectRemoteSourcePrompt(
  localSource: LocalSource,
  remoteSourcesOfSameType: RemoteSource[],
  remoteIdField: 'id' | 'uuid',
): Promise<RemoteSource> {
  const remoteOptions = remoteSourcesOfSameType.map((remote) => ({
    label: `Match it to ${remote.title} (ID: ${remote.id} on Shopify Partners)`,
    value: remote[remoteIdField],
  }))
  remoteOptions.push({label: 'Create new extension', value: 'create'})
  const uuid = await renderAutocompletePrompt({
    message: `How would you like to deploy your "${localSource.configuration.name}"?`,
    choices: remoteOptions,
  })
  return remoteSourcesOfSameType.find((remote) => remote[remoteIdField] === uuid)!
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

  return renderConfirmationPrompt({
    message: summary.question,
    infoTable,
    confirmationMessage: 'Yes, deploy to push changes',
    cancellationMessage: 'No, cancel',
  })
}

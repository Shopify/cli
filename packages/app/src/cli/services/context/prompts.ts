import {LocalSource, RemoteSource} from './identifiers.js'
import {LocalRemoteSource} from './id-matching.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {renderAutocompletePrompt, renderConfirmationPrompt, renderInfo} from '@shopify/cli-kit/node/ui'

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
  const infoTable = []

  if (summary.toCreate.length > 0) {
    infoTable.push({header: 'add', items: summary.toCreate.map((source) => source.localIdentifier)})
  }

  const toUpdate = Object.keys(summary.identifiers)

  if (toUpdate.length > 0) {
    infoTable.push({header: 'update', items: toUpdate})
  }

  if (summary.onlyRemote.length > 0) {
    infoTable.push({
      header: 'missing locally',
      items: summary.onlyRemote.map((source) => source.title),
      color: 'red',
      helperText: 'These extensions will be deleted from the app.',
    })
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

export async function extensionMigrationPrompt(toMigrate: LocalRemoteSource[]): Promise<boolean> {
  const migrationNames = toMigrate.map(({local}) => local.configuration.name).join(',')
  const allMigrationTypes = toMigrate.map(({remote}) => remote.type.toLocaleLowerCase())
  const uniqueMigrationTypes = allMigrationTypes.filter((type, i) => allMigrationTypes.indexOf(type) === i).join(',')

  renderInfo({
    headline: "Extension migrations can't be undone",
    body: `Your ${migrationNames} configuration has been updated. Migrating gives you access to new features and won't impact the end user experience. All previous extension versions will reflect this change.`,
  })

  return renderConfirmationPrompt({
    message: `Migrate ${migrationNames}?`,
    confirmationMessage: `Yes, confirm migration from ${uniqueMigrationTypes}`,
    cancellationMessage: 'No, cancel',
  })
}

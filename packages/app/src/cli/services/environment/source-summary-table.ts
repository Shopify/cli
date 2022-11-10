import {LocalSource, RemoteSource} from './identifiers.js'
import {IdentifiersExtensions} from '../../models/app/identifiers.js'
import {renderInfo, renderWarning} from '@shopify/cli-kit/node/ui'

interface SourceSummary {
  identifiers: IdentifiersExtensions
  toCreate: LocalSource[]
  onlyRemote: RemoteSource[]
}

export async function displaySourceSummaryTable(summary: SourceSummary) {
  if (summary.toCreate.length > 0) {
    await renderInfo({
      headline: 'I am going to create these new extensions:',
      body: summary.toCreate.map((source) => `${source.localIdentifier}\n`),
    })
  }

  const toUpdate = Object.keys(summary.identifiers)

  if (toUpdate.length > 0) {
    await renderInfo({
      headline: 'I am going to update these extensions:',
      body: toUpdate,
    })
  }

  if (summary.onlyRemote.length > 0) {
    await renderWarning({
      headline: 'These extensions are missing from the local project:',
      body: summary.onlyRemote.map((source) => source.title),
    })
  }
}

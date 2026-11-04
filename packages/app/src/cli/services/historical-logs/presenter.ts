import {logsOutput, type LogsResult} from './types.js'
import {outputInfo, outputResult, outputWarn, unstyled} from '@shopify/cli-kit/node/output'
import {renderTable} from '@shopify/cli-kit/node/ui'

export function renderHistoricalLogs(result: LogsResult, json: boolean, limit: number): void {
  if (json) {
    outputResult(logsOutput.encode(result))
    return
  }
  if (!result.logs.length) {
    outputInfo('No matching records available at query time.')
    return
  }
  const orderingLabel = {
    'subset-timestamp-asc': 'Used fast retrieval: returned records shown oldest first.',
    'timestamp-asc': 'Oldest first by timestamp.',
    'timestamp-desc': 'Newest first by timestamp.',
  }
  outputInfo(orderingLabel[result.ordering])
  const showApi = result.logs.some((record) => record.type === 'GRAPHQL_REQUEST')
  renderTable({
    rows: result.logs.map((record) => ({
      timestamp: terminalValue(record.timestamp),
      type: terminalValue(record.type),
      result: terminalValue(record.resultStatus),
      store: terminalValue(record.shopMyshopifyDomain),
      topicOrOperation: terminalValue(record.topic ?? record.operationName),
      ...(showApi ? {api: record.type === 'GRAPHQL_REQUEST' ? terminalValue(record.api) : '—'} : {}),
    })),
    columns: {
      timestamp: {header: 'Timestamp'},
      type: {header: 'Type'},
      result: {header: 'Result'},
      store: {header: 'Store'},
      topicOrOperation: {header: 'Topic / operation'},
      ...(showApi ? {api: {header: 'API'}} : {}),
    },
  })
  if (result.logs.length < limit) {
    outputInfo(
      `Returned all ${result.logs.length} matching ${result.logs.length === 1 ? 'record' : 'records'} available at query time.`,
    )
  }
  for (const limitation of result.limitations) outputWarn(limitation)
  outputInfo('Use --json for full records.')
}

function terminalValue(value: unknown): string {
  const text = typeof value === 'string' ? value : 'unknown'
  const tokens = Array.from(unstyled(text), (character) =>
    /[\p{Cc}\p{Cf}]/u.test(character) ? `\\u${character.codePointAt(0)!.toString(16).padStart(4, '0')}` : character,
  )
  const escaped = tokens.join('')
  if (escaped.length <= 100) return escaped
  let abbreviated = ''
  for (const token of tokens) {
    if (abbreviated.length + token.length > 99) break
    abbreviated += token
  }
  return `${abbreviated}…`
}

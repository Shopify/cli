import {logsOutput, type LogsResult} from './types.js'
import {outputInfo, outputResult, unstyled} from '@shopify/cli-kit/node/output'
import {renderTable} from '@shopify/cli-kit/node/ui'

export function renderHistoricalLogs(result: LogsResult, json: boolean): void {
  if (json) {
    outputResult(logsOutput.encode(result))
    return
  }
  outputInfo('Unordered, capped results; not necessarily the newest logs and may be incomplete.')
  if (!result.logs.length) {
    outputInfo('No matching records returned in this bounded search.')
    return
  }
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
  outputInfo('Summary only; … marks abbreviated values. Use --json for full records.')
}

function terminalValue(value: unknown): string {
  const text = typeof value === 'string' ? value : 'unknown'
  const escaped = unstyled(text).replace(
    /[\p{Cc}\p{Cf}]/gu,
    (character) => `\\u${character.codePointAt(0)!.toString(16).padStart(4, '0')}`,
  )
  return escaped.length > 100 ? `${escaped.slice(0, 99)}…` : escaped
}

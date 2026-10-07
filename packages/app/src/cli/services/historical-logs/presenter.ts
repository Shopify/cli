import {logsOutput, type LogsResult} from './types.js'
import {outputResult, unstyled} from '@shopify/cli-kit/node/output'

export function renderHistoricalLogs(result: LogsResult, json: boolean): void {
  if (json) {
    outputResult(logsOutput.encode(result))
    return
  }
  const {query} = result
  outputResult(
    `App: ${terminalValue(query.clientId)}\nTypes: ${query.types.join(', ')}\nWindow: ${query.since} ≤ timestamp < ${query.until}\nLimit: ${query.limit}\nUnordered results; additional matching records may exist.`,
  )
  for (const event of result.logs) {
    outputResult(
      [
        event.timestamp,
        event.type,
        event.outcome ?? 'unknown',
        event.storeDomain ?? 'unknown',
        event.webhook?.topic ?? event.function?.functionHandle ?? event.gid,
      ]
        .map(terminalValue)
        .join('\t'),
    )
  }
  if (result.pageInfo.limitReached)
    outputResult('Result limit reached; narrow the time window to retrieve fewer matches.')
  if (!result.logs.length) outputResult('No matching records returned in this bounded search.')
  for (const error of result.errors) outputResult(`${error.code}: ${terminalValue(error.message)}`)
  for (const limitation of result.limitations.slice(1)) outputResult(limitation)
}

function terminalValue(value: string): string {
  return unstyled(value).replace(
    /[\p{Cc}\p{Cf}]/gu,
    (character) => `\\u${character.codePointAt(0)!.toString(16).padStart(4, '0')}`,
  )
}

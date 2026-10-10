import {logError, logTypes, queryLimits, selectedLogTypes} from './catalog.js'

export interface LogInput {
  type?: string[]
  since?: string
  until?: string
  limit?: number
}

export function prepareLogInput(input: LogInput) {
  const types = selectedLogTypes(input.type)
  const limit = input.limit ?? queryLimits.defaultLimit
  if (!Number.isInteger(limit) || limit < 1 || limit > queryLimits.maximumLimit) {
    throw logError('INVALID_ARGUMENT', '--limit must be an integer between 1 and 1000.')
  }
  return {
    types,
    backendTypes: types.map((type) => logTypes.find(({name}) => name === type)!.backend),
    limit,
  }
}

export function resolveLogWindow(input: Pick<LogInput, 'since' | 'until'>, serverTime: string) {
  const anchorMilliseconds = Date.parse(serverTime)
  if (!Number.isFinite(anchorMilliseconds))
    throw logError('INVALID_RESPONSE', 'The scope response did not include a valid server time.')
  const anchor = BigInt(anchorMilliseconds) * 1000000n
  const until = input.until ?? new Date(anchorMilliseconds).toISOString()
  const end = parseTimestamp(until, '--until')
  const since = input.since ?? queryLimits.defaultSince
  const duration = /^(\d+)(s|m|h|d)$/.exec(since)
  const units = new Map([
    ['s', 1n],
    ['m', 60n],
    ['h', 3600n],
    ['d', 86400n],
  ])
  const nanoseconds = duration ? BigInt(duration[1]!) * units.get(duration[2]!)! * 1000000000n : undefined
  if (nanoseconds !== undefined && nanoseconds <= 0n) {
    throw logError(
      'INVALID_ARGUMENT',
      '--since requires a positive integer duration or an RFC 3339 timestamp with a timezone.',
    )
  }
  const start = nanoseconds === undefined ? parseTimestamp(since, '--since') : end - nanoseconds
  const day = 86400000000000n
  if (
    start >= end ||
    end > anchor ||
    start < anchor - BigInt(queryLimits.retentionDays) * day ||
    end - start > BigInt(queryLimits.maximumWindowDays) * day
  ) {
    throw logError(
      'INVALID_ARGUMENT',
      `Use a nonempty window of at most seven days within the preceding thirty days. Valid range: ${new Date(anchorMilliseconds - queryLimits.retentionDays * 86400000).toISOString()} through ${new Date(anchorMilliseconds).toISOString()}.`,
    )
  }
  const fraction = (start % 1000000000n).toString().padStart(9, '0').replace(/0+$/, '')
  const relativeStart = new Date(Number(start / 1000000000n) * 1000)
    .toISOString()
    .replace('.000Z', `${fraction ? `.${fraction}` : ''}Z`)
  return {
    since: nanoseconds === undefined ? since : relativeStart,
    until,
    anchor: new Date(anchorMilliseconds).toISOString(),
  }
}

function parseTimestamp(value: string, flag: string): bigint {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/.exec(value)
  const invalid = () =>
    logError(
      'INVALID_ARGUMENT',
      `${flag} requires a valid RFC 3339 timestamp with an explicit timezone (up to nine fractional digits).`,
    )
  if (!match) throw invalid()
  const date = new Date(`${match[1]}T${match[2]}Z`)
  if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 19) !== `${match[1]}T${match[2]}`) throw invalid()
  const seconds = Date.parse(`${match[1]}T${match[2]}${match[4]}`)
  if (!Number.isFinite(seconds)) throw invalid()
  return BigInt(seconds) * 1000000n + BigInt((match[3] ?? '').padEnd(9, '0'))
}

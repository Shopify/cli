import {logError, logFilters, queryLimits, selectedLogTypes} from './catalog.js'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {formatJsonOutputTimestamp} from '@shopify/cli-kit/node/json-output-schema'
import type {LogFilterInput} from '../../api/graphql/app-logs/generated/types.js'

export interface LogInput {
  type?: string[]
  store?: string
  status?: string
  topic?: string
  'status-code'?: string
  'operation-type'?: string
  'operation-name'?: string
  'request-id'?: string
  since?: string
  until?: string
  limit?: number
  sort?: string
  order?: string
}

export function prepareLogInput(input: LogInput) {
  const types = selectedLogTypes(input.type)
  if (!types.length) throw logError('INVALID_ARGUMENT', 'Select at least one log type.')
  const limit = input.limit ?? queryLimits.defaultLimit
  if (!Number.isInteger(limit) || limit < 1 || limit > queryLimits.maximumLimit) {
    throw logError('INVALID_ARGUMENT', '--limit must be an integer between 1 and 1000.')
  }
  if (input.sort !== undefined && input.sort !== 'timestamp')
    throw logError('INVALID_ARGUMENT', '--sort accepts timestamp.')
  if (input.order !== undefined && !['asc', 'desc'].includes(input.order))
    throw logError('INVALID_ARGUMENT', '--order accepts asc or desc.')
  if (input.order !== undefined && input.sort === undefined)
    throw logError('INVALID_ARGUMENT', '--order requires --sort.')
  const timestampOrdering = input.order === 'desc' ? 'timestamp-desc' : 'timestamp-asc'
  const ordering = input.sort === undefined ? 'none' : timestampOrdering
  const values: Partial<Record<(typeof logFilters)[number]['flag'], string>> = {}
  for (const definition of logFilters) {
    const value = input[definition.flag]
    if (value === undefined) continue
    if (typeof value !== 'string' || !value.trim())
      throw logError('INVALID_ARGUMENT', `--${definition.flag} requires one nonempty value.`)
    if (Buffer.byteLength(value, 'utf8') > 1024)
      throw logError('INVALID_ARGUMENT', `--${definition.flag} accepts at most 1024 UTF-8 bytes.`)
    values[definition.flag] = value
  }
  if (values.store) {
    const domain = normalizeStoreFqdn(
      /^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(values.store.trim()) ? `${values.store.trim()}.myshopify.com` : values.store,
    )
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain))
      throw logError('INVALID_ARGUMENT', 'Historical logs require a myshopify.com store domain.')
    values.store = domain
  }
  if (values.status && !['success', 'failure'].includes(values.status))
    throw logError('INVALID_ARGUMENT', '--status accepts success or failure.')
  if (values.topic && !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_./-]+$/.test(values.topic))
    throw logError('INVALID_ARGUMENT', '--topic requires an exact slash-form topic, such as orders/create.')
  if (values['status-code'] && !/^[1-5]\d{2}$/.test(values['status-code']))
    throw logError('INVALID_ARGUMENT', '--status-code accepts an exact code from 100 to 599, not a status class.')

  const filters: LogFilterInput[] = logFilters.flatMap(({flag, field}) => {
    const value = values[flag]
    return value === undefined
      ? []
      : [{field, operator: 'EQUALS', value: flag === 'status' ? value.toUpperCase() : value}]
  })
  const window = prepareLogWindow(input)
  return {
    types,
    filters,
    limit,
    ordering,
    window,
  }
}

function prepareLogWindow(input: Pick<LogInput, 'since' | 'until'>) {
  const since = input.since ?? queryLimits.defaultSince
  const duration = /^(\d+)(s|m|h|d)$/.exec(since)
  const units = new Map([
    ['s', 1],
    ['m', 60],
    ['h', 3600],
    ['d', 86400],
  ])
  const durationSeconds = duration ? Number(duration[1]) * units.get(duration[2]!)! : undefined
  if (durationSeconds !== undefined && (!Number.isSafeInteger(durationSeconds) || durationSeconds <= 0))
    throw logError('INVALID_ARGUMENT', '--since requires a positive integer duration or a whole-second timestamp.')
  const start = durationSeconds === undefined ? parseTimestamp(since, '--since') : undefined
  const end = input.until === undefined ? undefined : parseTimestamp(input.until, '--until')
  if (start !== undefined && end !== undefined && start >= end)
    throw logError('INVALID_ARGUMENT', '--since must be earlier than --until.')
  return {start, end, durationSeconds}
}

export function resolveLogWindow(window: ReturnType<typeof prepareLogWindow>) {
  const anchor = Math.floor(Date.now() / 1000) * 1000
  const end = window.end ?? anchor
  const start = window.start ?? end - window.durationSeconds! * 1000
  if (!Number.isFinite(new Date(start).valueOf()))
    throw logError('INVALID_ARGUMENT', '--since produces a timestamp outside the supported date range.')
  if (start >= end)
    throw logError('INVALID_ARGUMENT', '--since must be earlier than --until (the current time by default).')
  return {
    since: formatJsonOutputTimestamp(new Date(start)),
    until: formatJsonOutputTimestamp(new Date(end)),
  }
}

function parseTimestamp(value: string, flag: string): number {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(Z|[+-]\d{2}:\d{2})$/.exec(value)
  const invalid = () =>
    logError(
      'INVALID_ARGUMENT',
      `${flag} requires a whole-second RFC 3339 timestamp with a timezone; fractional input is not supported by the API.`,
    )
  if (!match) throw invalid()
  const date = new Date(`${match[1]}T${match[2]}Z`)
  if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 19) !== `${match[1]}T${match[2]}`) throw invalid()
  const milliseconds = Date.parse(value)
  if (!Number.isFinite(milliseconds)) throw invalid()
  return milliseconds
}

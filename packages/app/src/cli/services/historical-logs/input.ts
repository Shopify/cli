import {logError, logFilters, queryLimits, selectedLogTypes} from './catalog.js'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'
import {formatJsonOutputTimestamp} from '@shopify/cli-kit/node/json-output-schema'
import type {LogFilterInput} from '../../api/graphql/app-logs/generated/types.js'

export interface LogInput {
  type?: string | string[]
  store?: string | string[]
  status?: string | string[]
  topic?: string | string[]
  'status-code'?: string | string[]
  'operation-type'?: string | string[]
  'operation-name'?: string | string[]
  'request-id'?: string | string[]
  since?: string
  until?: string
  limit?: number
  sort?: string
  order?: string
}

export function prepareLogInput(input: LogInput) {
  const types = selectedLogTypes(input.type)
  if (!types.length) throw logError('invalid-argument', 'Select at least one log type.')
  const limit = input.limit ?? queryLimits.defaultLimit
  if (!Number.isInteger(limit) || limit < 1 || limit > queryLimits.maximumLimit) {
    throw logError('invalid-argument', '--limit must be an integer between 1 and 1000.')
  }
  if (input.sort !== undefined && input.sort !== 'timestamp')
    throw logError('invalid-argument', '--sort accepts timestamp.')
  if (input.order !== undefined && !['asc', 'desc'].includes(input.order))
    throw logError('invalid-argument', '--order accepts asc or desc.')
  if (input.order !== undefined && input.sort === undefined)
    throw logError('invalid-argument', '--order requires --sort.')
  const timestampOrdering = input.order === 'desc' ? 'timestamp-desc' : 'timestamp-asc'
  const ordering = input.sort === undefined ? 'none' : timestampOrdering
  const filters: LogFilterInput[] = logFilters.flatMap(({flag, field}) => {
    const inputValue = input[flag]
    if (inputValue === undefined) return []
    const values = Array.isArray(inputValue) ? inputValue : [inputValue]
    if (values.length < 1 || values.length > 50)
      throw logError('invalid-argument', `--${flag} accepts between 1 and 50 values.`)
    const normalizedValues = [...new Set(values.map((value) => normalizeLogFilterValue(flag, value)))]
    return [
      normalizedValues.length === 1
        ? {field, operator: 'EQUALS', value: normalizedValues[0]!}
        : {field, operator: 'IN', value: JSON.stringify(normalizedValues)},
    ]
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

function normalizeLogFilterValue(flag: (typeof logFilters)[number]['flag'], value: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw logError('invalid-argument', `--${flag} requires nonempty values.`)
  if (Buffer.byteLength(value, 'utf8') > 1024)
    throw logError('invalid-argument', `--${flag} accepts at most 1024 UTF-8 bytes per value.`)
  if (flag === 'store') {
    let domain: string
    try {
      domain = normalizeStoreFqdn(
        /^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(value.trim()) ? `${value.trim()}.myshopify.com` : value,
      )
    } catch (error) {
      if (error instanceof AbortError) error.code = 'invalid-argument'
      throw error
    }
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain))
      throw logError('invalid-argument', 'Historical logs require a myshopify.com store domain.')
    return domain
  }
  if (flag === 'status') {
    if (!['success', 'failure'].includes(value))
      throw logError('invalid-argument', '--status accepts success or failure.')
    return value.toUpperCase()
  }
  if (flag === 'topic' && !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_./-]+$/.test(value))
    throw logError('invalid-argument', '--topic requires an exact slash-form topic, such as orders/create.')
  if (flag === 'status-code' && !/^[1-5]\d{2}$/.test(value))
    throw logError('invalid-argument', '--status-code accepts an exact code from 100 to 599, not a status class.')
  return value
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
    throw logError('invalid-argument', '--since requires a positive integer duration or a whole-second timestamp.')
  const start = durationSeconds === undefined ? parseTimestamp(since, '--since') : undefined
  const end = input.until === undefined ? undefined : parseTimestamp(input.until, '--until')
  if (start !== undefined && end !== undefined && start >= end)
    throw logError('invalid-argument', '--since must be earlier than --until.')
  return {start, end, durationSeconds}
}

export function resolveLogWindow(window: ReturnType<typeof prepareLogWindow>) {
  const anchor = Math.floor(Date.now() / 1000) * 1000
  const end = window.end ?? anchor
  const start = window.start ?? end - window.durationSeconds! * 1000
  if (!Number.isFinite(new Date(start).valueOf()))
    throw logError('invalid-argument', '--since produces a timestamp outside the supported date range.')
  if (start >= end)
    throw logError('invalid-argument', '--since must be earlier than --until (the current time by default).')
  return {
    since: formatJsonOutputTimestamp(new Date(start)),
    until: formatJsonOutputTimestamp(new Date(end)),
  }
}

function parseTimestamp(value: string, flag: string): number {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(Z|[+-]\d{2}:\d{2})$/.exec(value)
  const invalid = () =>
    logError(
      'invalid-argument',
      `${flag} requires ${flag === '--since' ? 'a positive integer duration (s/m/h/d) or ' : ''}a whole-second RFC 3339 timestamp with a timezone; fractional input is not supported by the API.`,
    )
  if (!match) throw invalid()
  const date = new Date(`${match[1]}T${match[2]}Z`)
  if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 19) !== `${match[1]}T${match[2]}`) throw invalid()
  const milliseconds = Date.parse(value)
  if (!Number.isFinite(milliseconds)) throw invalid()
  return milliseconds
}

import {logError, logFilters, queryLimits, selectedLogTypes} from './catalog.js'
import {historicalLogFlags} from './flags.js'
import {discoverLogTypes} from './type-discovery.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

type LogTypeName = ReturnType<typeof selectedLogTypes>[number]['name']

const FilterSchema = zod
  .object({
    name: zod
      .string()
      .regex(/^[a-z]+(?:-[a-z]+)*$/)
      .describe('Long flag name without the -- prefix.'),
    kind: zod.enum(['filter', 'query', 'output']),
    description: zod.string().min(1),
    valueFormat: zod.string(),
    allowedValues: zod
      .array(zod.string())
      .nullable()
      .describe('Exhaustive choices, or null for a format-defined value.'),
    default: zod
      .union([zod.string(), zod.number(), zod.boolean(), zod.array(zod.string())])
      .nullable()
      .describe(
        'The literal retrieval default, or null when unset, dynamic, or conditional; see matching for details.',
      ),
    repeatable: zod.boolean(),
    applicableTypes: zod.array(zod.enum(selectedLogTypes().map(({name}) => name) as [LogTypeName, ...LogTypeName[]])),
    matching: zod.string(),
    vocabulary: zod.enum(['fixed', 'open']),
    required: zod.boolean(),
    dependencies: zod
      .array(zod.string())
      .describe('Other flag names required when this input is supplied, without the -- prefix.'),
    incompatibleWith: zod
      .array(zod.string())
      .describe('Combinations rejected by retrieval, not combinations that match no records.'),
  })
  .strict()

export const logFiltersJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppLogFilters',
  schema: zod
    .object({
      filters: zod
        .array(FilterSchema)
        .describe(
          'Local app logs-next record filters and query/output controls, sorted by long flag name. Without --type, lists all inputs; selected types return only common inputs. Does not check app access or log availability.',
        ),
    })
    .strict(),
})

export type LogFiltersResult = InferJsonOutputSchema<typeof logFiltersJsonOutputSchema>
type FilterDetails = Pick<LogFiltersResult['filters'][number], 'valueFormat' | 'matching' | 'vocabulary'> & {
  default?: LogFiltersResult['filters'][number]['default']
  description?: string
}

const exactMatching =
  'One exact value. Different record filters combine with AND; records without the field are excluded.'
const recordDetails: Record<(typeof logFilters)[number]['flag'], FilterDetails> = {
  store: {
    valueFormat: 'Store handle or myshopify.com domain/URL',
    vocabulary: 'open',
    matching: `${exactMatching} Normalized to a myshopify.com domain before matching.`,
  },
  status: {
    valueFormat: 'Recorded result status',
    vocabulary: 'fixed',
    matching: `${exactMatching} Uses the recorded result status, not inferred from HTTP codes or response bodies.`,
  },
  topic: {
    valueFormat: 'Slash-form webhook topic, such as orders/create',
    vocabulary: 'open',
    matching: exactMatching,
  },
  'status-code': {
    description: 'Exact webhook HTTP status code (100–599).',
    valueFormat: 'Three-digit HTTP code from 100 to 599',
    vocabulary: 'fixed',
    matching: exactMatching,
  },
  'operation-type': {
    valueFormat: 'Nonempty recorded GraphQL operation kind',
    vocabulary: 'open',
    matching: exactMatching,
  },
  'operation-name': {
    valueFormat: 'Nonempty client-supplied GraphQL operation name',
    vocabulary: 'open',
    matching: `${exactMatching} Matches the operation name, not a root API field.`,
  },
  'request-id': {
    valueFormat: 'Nonempty GraphQL request identifier',
    vocabulary: 'open',
    matching: exactMatching,
  },
}

const queryFlags = [
  ['type', historicalLogFlags.type],
  ['since', historicalLogFlags.since],
  ['until', historicalLogFlags.until],
  ['limit', historicalLogFlags.limit],
  ['sort', historicalLogFlags.sort],
  ['order', historicalLogFlags.order],
] as const
const queryDetails: Record<(typeof queryFlags)[number][0], FilterDetails> = {
  type: {
    valueFormat: 'Log type name',
    vocabulary: 'fixed',
    default: selectedLogTypes().map(({name}) => name),
    matching:
      'Retrieval includes records of any selected type (OR). In filters discovery, repeated --type returns inputs common to every selected type (intersection). Repeated names are deduplicated.',
  },
  since: {
    valueFormat: 'Positive integer duration with s/m/h/d suffix, or whole-second RFC 3339 timestamp with timezone',
    vocabulary: 'open',
    default: queryLimits.defaultSince,
    matching:
      'Inclusive start, earlier than --until. Durations are relative to --until (current time by default). Documented API bounds: 30-day lookback and seven-day maximum window.',
  },
  until: {
    valueFormat: 'Whole-second RFC 3339 timestamp with timezone',
    vocabulary: 'open',
    matching: 'Exclusive end, later than --since; defaults to the current time. Fractional seconds are not accepted.',
  },
  limit: {
    valueFormat: `Integer from 1 to ${queryLimits.maximumLimit}`,
    vocabulary: 'fixed',
    default: queryLimits.defaultLimit,
    matching: 'Caps returned records. Without --sort, a capped result is not necessarily the oldest or newest matches.',
  },
  sort: {
    valueFormat: 'Sort key',
    vocabulary: 'fixed',
    matching:
      'Sorts matches on the server before applying --limit. Omit for faster retrieval; returned records are still displayed oldest first.',
  },
  order: {
    valueFormat: 'Sort direction',
    vocabulary: 'fixed',
    matching: 'With --sort, defaults to asc: selects oldest matches first. Use desc to select newest matches first.',
  },
}

const outputFlags = [
  ['json', jsonFlag.json],
  ['no-input', globalFlags['no-input']],
  ['no-color', globalFlags['no-color']],
  ['verbose', globalFlags.verbose],
  ['json-schema', {description: "Print the command's JSON schemas."}],
] as const
const outputDetails: Record<(typeof outputFlags)[number][0], FilterDetails> = {
  json: {
    valueFormat: 'Boolean switch',
    vocabulary: 'fixed',
    default: false,
    matching: 'Selects JSON output, independently of --no-input. Does not change record matching.',
  },
  'json-schema': {
    valueFormat: 'Boolean switch',
    vocabulary: 'fixed',
    default: false,
    matching: 'Prints the result, error, and event schemas without retrieving logs.',
  },
  'no-input': {
    valueFormat: 'Boolean switch',
    vocabulary: 'fixed',
    default: false,
    matching: 'Disables prompts independently of --json. Does not change record matching.',
  },
  'no-color': {
    valueFormat: 'Boolean switch',
    vocabulary: 'fixed',
    default: false,
    matching: 'Disables color. Does not change record matching.',
  },
  verbose: {
    valueFormat: 'Boolean switch',
    vocabulary: 'fixed',
    default: false,
    matching: 'Increases diagnostic output. Does not change record matching.',
  },
}

export function discoverLogFilters(types?: string[]): LogFiltersResult {
  const selectedTypes = selectedLogTypes(types).map(({name}) => name)
  if (selectedTypes.length === 0)
    throw logError('invalid-argument', 'Select at least one log type: webhook or graphql.')
  const catalog = discoverLogTypes().types
  const filters: LogFiltersResult['filters'] = logFilters.map(({flag}) => {
    const definition = historicalLogFlags[flag]
    const details = recordDetails[flag]
    return {
      name: flag,
      kind: 'filter',
      description: details.description ?? definition.description ?? '',
      valueFormat: `${details.valueFormat}; one nonempty value, at most 1024 UTF-8 bytes`,
      allowedValues: definition.options ? [...definition.options] : null,
      default: null,
      repeatable: false,
      applicableTypes: catalog.filter(({filters}) => filters.includes(flag)).map(({name}) => name),
      matching: details.matching,
      vocabulary: details.vocabulary,
      required: false,
      dependencies: [],
      incompatibleWith: [],
    }
  })
  for (const [name, definition] of queryFlags) {
    const details = queryDetails[name]
    filters.push({
      name,
      kind: 'query',
      description: definition.description ?? '',
      valueFormat: details.valueFormat,
      allowedValues: definition.options ? [...definition.options] : null,
      default: details.default ?? null,
      repeatable: definition.multiple ?? false,
      applicableTypes: catalog.map(({name}) => name),
      matching: details.matching,
      vocabulary: details.vocabulary,
      required: definition.required ?? false,
      dependencies: definition.dependsOn ?? [],
      incompatibleWith: definition.exclusive ?? [],
    })
  }
  for (const [name, definition] of outputFlags) {
    const details = outputDetails[name]
    filters.push({
      name,
      kind: 'output',
      description: definition.description ?? '',
      valueFormat: details.valueFormat,
      allowedValues: null,
      default: details.default ?? null,
      repeatable: false,
      applicableTypes: catalog.map(({name}) => name),
      matching: details.matching,
      vocabulary: details.vocabulary,
      required: false,
      dependencies: [],
      incompatibleWith: [],
    })
  }
  return logFiltersJsonOutputSchema.validate({
    filters: filters
      .filter(
        ({applicableTypes}) => types === undefined || selectedTypes.every((type) => applicableTypes.includes(type)),
      )
      .sort((left, right) => left.name.localeCompare(right.name)),
  })
}

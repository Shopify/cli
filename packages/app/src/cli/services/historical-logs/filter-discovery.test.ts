import {discoverLogFilters, logFiltersJsonOutputSchema} from './filter-discovery.js'
import {discoverLogTypes} from './type-discovery.js'
import {historicalLogFlags} from './flags.js'
import {prepareLogInput} from './input.js'
import {expect, test} from 'vitest'

const allNames = [
  'json',
  'json-schema',
  'limit',
  'no-color',
  'no-input',
  'operation-name',
  'operation-type',
  'order',
  'request-id',
  'since',
  'sort',
  'status',
  'status-code',
  'store',
  'topic',
  'type',
  'until',
  'verbose',
]
const commonNames = [
  'json',
  'json-schema',
  'limit',
  'no-color',
  'no-input',
  'order',
  'since',
  'sort',
  'status',
  'store',
  'type',
  'until',
  'verbose',
]

test('lists all seven record predicates and current query/output controls, sorted by flag name', () => {
  const result = discoverLogFilters()
  expect(result.filters.map(({name}) => name)).toEqual(allNames)
  expect(result.filters.filter(({kind}) => kind === 'filter').map(({name}) => name)).toEqual([
    'operation-name',
    'operation-type',
    'request-id',
    'status',
    'status-code',
    'store',
    'topic',
  ])
  expect(result.filters.filter(({kind}) => kind === 'query').map(({name}) => name)).toEqual([
    'limit',
    'order',
    'since',
    'sort',
    'type',
    'until',
  ])
})

test.each([
  {types: ['webhook'], predicates: ['status', 'status-code', 'store', 'topic']},
  {types: ['graphql'], predicates: ['operation-name', 'operation-type', 'request-id', 'status', 'store']},
  {types: ['graphql', 'webhook'], predicates: ['status', 'store']},
])('selects the intersection for $types', ({types, predicates}) => {
  const filters = discoverLogFilters(types).filters
  expect(filters.filter(({kind}) => kind === 'filter').map(({name}) => name)).toEqual(predicates)
  expect(filters.filter(({kind}) => kind !== 'filter')).toHaveLength(11)
})

test('distinguishes the default union from an explicit intersection and deduplicates selections', () => {
  expect(discoverLogFilters(['webhook', 'graphql']).filters.map(({name}) => name)).toEqual(commonNames)
  expect(discoverLogFilters(['webhook', 'webhook'])).toEqual(discoverLogFilters(['webhook']))
  expect(discoverLogFilters(['graphql', 'webhook', 'graphql'])).toEqual(discoverLogFilters(['webhook', 'graphql']))
  expect(discoverLogFilters().filters).toHaveLength(18)
})

test('reuses types discovery applicability without exposing internal backend fields', () => {
  for (const filter of discoverLogFilters().filters) {
    if (filter.kind === 'filter') {
      expect(filter.applicableTypes).toEqual(
        discoverLogTypes()
          .types.filter(({filters}) => filters.some((name) => name === filter.name))
          .map(({name}) => name),
      )
    } else {
      expect(filter.applicableTypes).toEqual(['webhook', 'graphql'])
    }
    expect(filter).not.toHaveProperty('field')
    expect(filter).not.toHaveProperty('backend')
    expect(filter.required).toBe(false)
    expect(filter.incompatibleWith).toEqual([])
    expect(filter.dependencies).toEqual(filter.name === 'order' ? ['sort'] : [])
  }
})

test('describes exact predicates, recorded status, and open operation names/kinds', () => {
  const predicates = discoverLogFilters().filters.filter(({kind}) => kind === 'filter')
  for (const filter of predicates) {
    expect(filter.default).toBeNull()
    expect(filter.repeatable).toBe(false)
    expect(filter.valueFormat).toContain('at most 1024 UTF-8 bytes')
    expect(filter.matching).toContain('Different record filters combine with AND')
    expect(filter.matching).toContain('records without the field are excluded')
  }
  expect(predicates.find(({name}) => name === 'status')).toEqual({
    name: 'status',
    kind: 'filter',
    description: 'Recorded result status; not inferred from HTTP codes or response bodies.',
    valueFormat: 'Recorded result status; one nonempty value, at most 1024 UTF-8 bytes',
    allowedValues: ['success', 'failure'],
    default: null,
    repeatable: false,
    applicableTypes: ['webhook', 'graphql'],
    matching:
      'One exact value. Different record filters combine with AND; records without the field are excluded. Uses the recorded result status, not inferred from HTTP codes or response bodies.',
    vocabulary: 'fixed',
    required: false,
    dependencies: [],
    incompatibleWith: [],
  })
  expect(predicates.find(({name}) => name === 'operation-type')).toMatchObject({
    vocabulary: 'open',
    allowedValues: null,
  })
  expect(predicates.find(({name}) => name === 'operation-name')?.matching).toContain('not a root API field')
  expect(predicates.find(({name}) => name === 'status-code')).toMatchObject({
    description: 'Exact webhook HTTP status code (100–599).',
    vocabulary: 'fixed',
    allowedValues: null,
  })
  expect(prepareLogInput({'operation-type': 'custom-kind', topic: 'orders/create'}).filters).toEqual([
    {field: 'TOPIC', operator: 'EQUALS', value: 'orders/create'},
    {field: 'OPERATION_TYPE', operator: 'EQUALS', value: 'custom-kind'},
  ])
})

test('describes actual query defaults, choices, dependencies, and retrieval OR separately from discovery', () => {
  const filters = discoverLogFilters().filters
  expect(filters.find(({name}) => name === 'type')).toMatchObject({
    default: ['webhook', 'graphql'],
    allowedValues: ['webhook', 'graphql'],
    repeatable: true,
  })
  expect(filters.find(({name}) => name === 'type')?.matching).toContain('OR')
  expect(filters.find(({name}) => name === 'type')?.matching).toContain('intersection')
  expect(filters.find(({name}) => name === 'limit')).toMatchObject({
    default: 20,
    valueFormat: 'Integer from 1 to 1000',
  })
  expect(filters.find(({name}) => name === 'since')).toMatchObject({default: '1h'})
  expect(filters.find(({name}) => name === 'since')?.matching).toContain('Documented API bounds')
  expect(filters.find(({name}) => name === 'until')).toMatchObject({default: null})
  expect(filters.find(({name}) => name === 'until')?.matching).toContain('current time')
  expect(filters.find(({name}) => name === 'sort')).toMatchObject({default: null, allowedValues: ['timestamp']})
  expect(filters.find(({name}) => name === 'order')).toMatchObject({
    default: null,
    allowedValues: ['asc', 'desc'],
    dependencies: ['sort'],
  })
  expect(filters.find(({name}) => name === 'order')?.matching).toContain('defaults to asc')
  expect(filters.find(({name}) => name === 'limit')?.default).toEqual(historicalLogFlags.limit.default)
  expect(filters.find(({name}) => name === 'since')?.default).toEqual(historicalLogFlags.since.default)
  expect(filters.find(({name}) => name === 'order')?.dependencies).toEqual(historicalLogFlags.order.dependsOn)
})

test('output switches have no invented boolean argument values', () => {
  const outputs = discoverLogFilters().filters.filter(({kind}) => kind === 'output')
  expect(outputs.map(({name}) => name)).toEqual(['json', 'json-schema', 'no-color', 'no-input', 'verbose'])
  for (const output of outputs) {
    expect(output).toMatchObject({
      allowedValues: null,
      default: false,
      repeatable: false,
      valueFormat: 'Boolean switch',
    })
  }
})

test.each([['function'], ['WEBHOOK'], ['graphql-request'], ['webhook', 'bad'], ['']])(
  'rejects unsupported types rather than returning an empty catalog: %j',
  (...types) => {
    expect(() => discoverLogFilters(types)).toThrow('Supported log types are webhook and graphql.')
  },
)

test('rejects an explicitly empty selection', () => {
  expect(() => discoverLogFilters([])).toThrow('Select at least one log type')
})

test('validates the public projection strictly', () => {
  const result = discoverLogFilters()
  expect(JSON.parse(logFiltersJsonOutputSchema.encode(result))).toEqual(result)
  expect(() => logFiltersJsonOutputSchema.validate({...result, clientId: 'app'})).toThrow()
  expect(() => logFiltersJsonOutputSchema.validate({filters: [{...result.filters[0], backend: 'WEBHOOK'}]})).toThrow()
  expect(() =>
    logFiltersJsonOutputSchema.validate({filters: [{...result.filters[0], applicableTypes: ['function']}]}),
  ).toThrow()
  expect(() => logFiltersJsonOutputSchema.validate({filters: [{name: 'store'}]})).toThrow()
  expect(() => logFiltersJsonOutputSchema.validate(result.filters)).toThrow()
})

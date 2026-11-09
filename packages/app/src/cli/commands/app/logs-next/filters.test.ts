import LogFilters from './filters.js'
import {getAppConfigurationContext} from '../../../models/app/loader.js'
import {logFiltersJsonOutputSchema} from '../../../services/historical-logs/filter-discovery.js'
import {Config} from '@oclif/core'
import {afterEach, expect, test, vi} from 'vitest'
import {launchCLI} from '@shopify/cli-kit/node/cli-launcher'
import {ShopifyConfig} from '@shopify/cli-kit/node/custom-oclif-loader'
import {shopifyFetch} from '@shopify/cli-kit/node/http'
import {unstyled} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedAppManagementAndBusinessPlatform} from '@shopify/cli-kit/node/session'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'

vi.mock('../../../models/app/loader.js', () => ({
  getAppConfigurationContext: vi.fn(() => {
    throw new Error('Discovery must not resolve an app')
  }),
}))
vi.mock('@shopify/cli-kit/node/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/session')>()),
  ensureAuthenticatedAppManagementAndBusinessPlatform: vi.fn(() => {
    throw new Error('Discovery must not authenticate')
  }),
}))
vi.mock('@shopify/cli-kit/node/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/http')>()),
  shopifyFetch: vi.fn(() => {
    throw new Error('Discovery must not make a network request')
  }),
}))

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
const expectedStatus = {
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
}

afterEach(() => {
  expect(getAppConfigurationContext).not.toHaveBeenCalled()
  expect(ensureAuthenticatedAppManagementAndBusinessPlatform).not.toHaveBeenCalled()
  expect(shopifyFetch).not.toHaveBeenCalled()
  vi.unstubAllEnvs()
  mockAndCaptureOutput().clear()
})

test('stays hidden and initializes help with its strict schema', () => {
  expect(LogFilters.hidden).toBe(true)
  expect(LogFilters.jsonOutputSchema).toBe(logFiltersJsonOutputSchema)
  expect(LogFilters.description).toContain('AppLogFilters')
  expect(Object.keys(LogFilters.flags).sort()).toEqual(['json', 'no-color', 'no-input', 'type', 'verbose'])
})

test.each([{argv: []}, {argv: ['--no-input']}])('writes one complete JSON result with $argv', async ({argv}) => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await new LogFilters(['--json', ...argv], await Config.load()).run()
    const result = logFiltersJsonOutputSchema.validate(JSON.parse(stdout()))
    expect(Object.keys(result)).toEqual(['filters'])
    expect(result.filters.map(({name}) => name)).toEqual(allNames)
    expect(result.filters.find(({name}) => name === 'status')).toEqual(expectedStatus)
    expect(stderr()).toBe('')
  })
})

test.each([
  {
    types: ['webhook'],
    names: allNames.filter((name) => !['operation-name', 'operation-type', 'request-id'].includes(name)),
  },
  {types: ['graphql'], names: allNames.filter((name) => !['topic', 'status-code'].includes(name))},
  {types: ['webhook', 'graphql'], names: commonNames},
  {types: ['webhook', 'graphql', 'webhook'], names: commonNames},
])('parses type selections $types with intersection semantics', async ({types, names}) => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await new LogFilters(['--json', ...types.flatMap((type) => ['--type', type])], await Config.load()).run()
    const result = logFiltersJsonOutputSchema.validate(JSON.parse(stdout()))
    expect(result.filters.map(({name}) => name)).toEqual(names)
    expect(result.filters.find(({name}) => name === 'status')).toEqual(expectedStatus)
    expect(stderr()).toBe('')
  })
})

test.each([
  {argv: [], predicates: ['operation-name', 'operation-type', 'request-id', 'status', 'store']},
  {argv: ['--type', 'webhook'], predicates: ['status', 'status-code', 'store', 'topic']},
])('honors environment flags, with explicit type taking precedence: $argv', async ({argv, predicates}) => {
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  vi.stubEnv('SHOPIFY_FLAG_TYPE', 'graphql')
  vi.stubEnv('SHOPIFY_FLAG_CLIENT_ID', 'unused-app')
  vi.stubEnv('SHOPIFY_FLAG_PATH', '/not-an-app')
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await new LogFilters(argv, await Config.load()).run()
    const result = logFiltersJsonOutputSchema.validate(JSON.parse(stdout()))
    expect(result.filters.filter(({kind}) => kind === 'filter').map(({name}) => name)).toEqual(predicates)
    expect(stderr()).toBe('')
  })
})

test.each([{argv: []}, {argv: ['--no-input']}])(
  'renders real human details without enabling JSON: $argv',
  async ({argv}) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await new LogFilters(['--type', 'webhook', ...argv], await Config.load()).run()
      const output = unstyled(stderr()).replace(/\s+/g, ' ')
      expect(stdout()).toBe('')
      expect(output).toContain('App log filters')
      expect(output).toContain('--topic')
      expect(output).toContain('--status-code')
      expect(output).not.toContain('--operation-name')
      expect(output).toContain('Requires: --sort.')
      expect(output).toContain('1000')
      expect(output).toContain('success | failure')
    })
  },
)

test('human details keep full flag names and fit the default 80-column output', async () => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await new LogFilters([], await Config.load()).run()
    const output = unstyled(stderr())
    expect(stdout()).toBe('')
    for (const name of allNames) expect(output).toContain(`--${name}`)
    for (const line of output.split('\n')) expect(line.length).toBeLessThanOrEqual(80)
  })
})

test.each(['function', 'WEBHOOK', 'GraphQL', 'graphql-request', ''])(
  'rejects unsupported type %s with alternatives',
  async (type) => {
    await expect(new LogFilters(['--type', type, '--json'], await Config.load()).run()).rejects.toThrow(
      /webhook.*graphql/,
    )
  },
)

test('rejects unsupported environment types', async () => {
  vi.stubEnv('SHOPIFY_FLAG_TYPE', 'function')
  await expect(new LogFilters(['--json'], await Config.load()).run()).rejects.toThrow(/webhook.*graphql/)
})

test('invalid selections write one fatal JSON object and exit nonzero', async () => {
  vi.stubEnv('SHOPIFY_CLI_NO_ANALYTICS', '1')
  const exit = vi.spyOn(process, 'exit').mockReturnValue(undefined as never)
  try {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await LogFilters.run(['--type', 'function', '--json', '--no-input'])
      expect(JSON.parse(stdout())).toEqual({
        error: expect.objectContaining({message: expect.stringMatching(/webhook.*graphql/)}),
      })
      expect(stderr()).toBe('')
      expect(exit).toHaveBeenCalledWith(2)
    })
  } finally {
    exit.mockRestore()
  }
})

test.each([
  ['--client-id', 'app-id'],
  ['--path', '/tmp/app'],
  ['--config', 'dev'],
  ['--auth-alias', 'account'],
  ['--status', 'failure'],
  ['webhook'],
])('rejects app context, retrieval filters and positional arguments %j', async (...argv) => {
  await expect(new LogFilters(argv, await Config.load()).run()).rejects.toThrow()
})

test('prints the standard JSON Schema without discovery, authentication, app resolution, or network calls', async () => {
  vi.spyOn(ShopifyConfig.prototype, 'runHook').mockResolvedValue({successes: [], failures: []})
  const run = vi.spyOn(LogFilters.prototype, 'run')
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await launchCLI({
      moduleURL: new URL('../../../../../../cli/src/bootstrap.ts', import.meta.url).href,
      argv: ['app', 'logs-next', 'filters', '--json-schema'],
      lazyCommandLoader: async () => LogFilters,
    })
    const schema = JSON.parse(stdout())
    expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#')
    expect(schema.definitions.Result.additionalProperties).toBe(false)
    expect(schema.definitions.Result.properties.filters.items.additionalProperties).toBe(false)
    expect(schema.definitions.Result.properties.filters.items.properties.applicableTypes.items.enum).toEqual([
      'webhook',
      'graphql',
    ])
    expect(schema.definitions).toHaveProperty('Error')
    expect(schema.definitions).toHaveProperty('Event')
    expect(stderr()).toBe('')
    expect(run).not.toHaveBeenCalled()
  })
})

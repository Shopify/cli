import LogTypes from './types.js'
import {getAppConfigurationContext} from '../../../models/app/loader.js'
import {logTypesJsonOutputSchema} from '../../../services/historical-logs/type-discovery.js'
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

const expectedTypes = [
  {
    name: 'webhook',
    description: 'Webhook delivery logs.',
    filters: ['store', 'status', 'topic', 'status-code'],
    limitations: [
      'Each filter accepts one exact value. Different filters combine with AND; records without the filtered field are excluded.',
      '--status accepts success or failure using the recorded result status, not inferred from HTTP codes or response bodies.',
      '--topic requires an exact slash-form topic, such as orders/create. --status-code accepts an exact HTTP code from 100 to 599.',
    ],
    example: 'shopify app logs-next --type webhook --topic orders/create --since 30m',
  },
  {
    name: 'graphql',
    description: 'GraphQL request logs.',
    filters: ['store', 'status', 'operation-type', 'operation-name', 'request-id'],
    limitations: [
      'Each filter accepts one exact value. Different filters combine with AND; records without the filtered field are excluded.',
      '--status accepts success or failure using the recorded result status, not inferred from HTTP codes or response bodies.',
      '--operation-name matches the client-supplied operation name, not a root API field. --operation-type matches the recorded operation kind; --request-id matches the request identifier.',
    ],
    example: 'shopify app logs-next --type graphql --operation-name MyQuery --since 30m',
  },
]

afterEach(() => {
  expect(getAppConfigurationContext).not.toHaveBeenCalled()
  expect(ensureAuthenticatedAppManagementAndBusinessPlatform).not.toHaveBeenCalled()
  expect(shopifyFetch).not.toHaveBeenCalled()
  vi.unstubAllEnvs()
  mockAndCaptureOutput().clear()
})

test('stays hidden and exposes the schema before help is initialized', () => {
  expect(LogTypes.hidden).toBe(true)
  expect(LogTypes.jsonOutputSchema).toBe(logTypesJsonOutputSchema)
  expect(LogTypes.description).toContain('AppLogTypes')
  expect(LogTypes.flags).not.toHaveProperty('client-id')
})

test.each([{argv: []}, {argv: ['--no-input']}])(
  'returns the complete local catalog as one JSON object with $argv',
  async ({argv}) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await new LogTypes(['--json', ...argv], await Config.load()).run()
      expect(JSON.parse(stdout())).toEqual({types: expectedTypes})
      expect(stderr()).toBe('')
    })
  },
)

test.each(['webhook', 'graphql'])('parses positional %s and returns a one-item types array', async (type) => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await new LogTypes(['--json', type, '--no-input'], await Config.load()).run()
    expect(JSON.parse(stdout())).toEqual({types: expectedTypes.filter(({name}) => name === type)})
    expect(stderr()).toBe('')
  })
})

test('honors JSON environment output without reading app or retrieval flags', async () => {
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  vi.stubEnv('SHOPIFY_FLAG_CLIENT_ID', 'unused-app')
  vi.stubEnv('SHOPIFY_FLAG_TYPE', 'unsupported-retrieval-type')
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await new LogTypes([], await Config.load()).run()
    expect(JSON.parse(stdout())).toEqual({types: expectedTypes})
    expect(stderr()).toBe('')
  })
})

test.each([{argv: []}, {argv: ['--no-input']}])(
  'renders a human summary without selecting JSON with $argv',
  async ({argv}) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await new LogTypes(argv, await Config.load()).run()
      expect(stdout()).toBe('')
      expect(stderr()).toContain('Type')
      expect(stderr()).toContain('Description')
      expect(stderr()).toContain('webhook')
      expect(stderr()).toContain('Webhook delivery logs.')
      expect(stderr()).toContain('graphql')
      expect(stderr()).toContain('GraphQL request logs.')
      expect(stderr()).not.toContain('WEBHOOK')
    })
  },
)

test.each(['webhook', 'graphql'])('renders %s filters, limitations, and a working retrieval example', async (type) => {
  const columns = Object.getOwnPropertyDescriptor(process.stdout, 'columns')
  Object.defineProperty(process.stdout, 'columns', {value: 240, configurable: true})
  try {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await new LogTypes([type, '--no-input'], await Config.load()).run()
      const output = unstyled(stderr()).replaceAll('│', '').replace(/\s+/g, ' ')
      const expected = expectedTypes.find(({name}) => name === type)!
      expect(stdout()).toBe('')
      expect(output).toContain(expected.description)
      for (const filter of expected.filters) expect(output).toContain(`--${filter}`)
      for (const limitation of expected.limitations) expect(output).toContain(limitation)
      expect(output).toContain(expected.example)
    })
  } finally {
    if (columns) Object.defineProperty(process.stdout, 'columns', columns)
    else Reflect.deleteProperty(process.stdout, 'columns')
  }
})

test.each(['function', 'WEBHOOK', 'GraphQL', 'graphql-request'])(
  'rejects unknown type %s with supported alternatives',
  async (type) => {
    await expect(new LogTypes([type, '--json'], await Config.load()).run()).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'Supported log types are webhook and graphql.',
    })
  },
)

test('unknown types emit one fatal JSON object and exit nonzero', async () => {
  vi.stubEnv('SHOPIFY_CLI_NO_ANALYTICS', '1')
  const exit = vi.spyOn(process, 'exit').mockReturnValue(undefined as never)
  try {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await LogTypes.run(['function', '--json', '--no-input'])
      expect(JSON.parse(stdout())).toEqual({
        error: {
          type: 'abort',
          code: 'invalid-argument',
          message: 'Supported log types are webhook and graphql.',
        },
      })
      expect(stderr()).toBe('')
      expect(exit).toHaveBeenCalledWith(1)
    })
  } finally {
    exit.mockRestore()
  }
})

test.each([
  ['--client-id', 'app-id'],
  ['--path', '/tmp/app'],
  ['--type', 'webhook'],
  ['webhook', 'graphql'],
])('rejects unsupported flags and extra arguments %j', async (...argv) => {
  await expect(new LogTypes(argv, await Config.load()).run()).rejects.toThrow()
})

test('prints the standard JSON Schema without running discovery or any remote setup', async () => {
  vi.spyOn(ShopifyConfig.prototype, 'runHook').mockResolvedValue({successes: [], failures: []})
  const run = vi.spyOn(LogTypes.prototype, 'run')
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await launchCLI({
      moduleURL: new URL('../../../../../../cli/src/bootstrap.ts', import.meta.url).href,
      argv: ['app', 'logs-next', 'types', '--json-schema'],
      lazyCommandLoader: async () => LogTypes,
    })
    const schema = JSON.parse(stdout())
    expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#')
    expect(schema.definitions.Result.properties.types.items.properties.name.enum).toEqual(['webhook', 'graphql'])
    expect(schema.definitions.Result.additionalProperties).toBe(false)
    expect(schema.definitions).toHaveProperty('Error')
    expect(schema.definitions).toHaveProperty('Event')
    expect(stderr()).toBe('')
    expect(run).not.toHaveBeenCalled()
  })
})

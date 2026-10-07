import Execute from './execute.js'
import {prepareExecuteContext} from '../../utilities/execute-command-helpers.js'
import {createAdminSessionAsApp, resolveApiVersion} from '../../services/graphql/common.js'
import {appExecuteJsonOutputSchema} from '../../services/execute-operation/types.js'
import {
  testAppLinked,
  testOrganization,
  testOrganizationApp,
  testOrganizationStore,
  testProject,
} from '../../models/app/app.test-data.js'
import {Config} from '@oclif/core'
import {afterEach, beforeEach, expect, test, vi} from 'vitest'
import {ClientError} from 'graphql-request'
import {GraphQLError} from 'graphql'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {AbortError, handler} from '@shopify/cli-kit/node/error'
import {fileExists, inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {cwd, joinPath, resolvePath, relativePath} from '@shopify/cli-kit/node/path'
import {renderSingleTask} from '@shopify/cli-kit/node/ui'

vi.mock('../../utilities/execute-command-helpers.js')
vi.mock('../../services/graphql/common.js')
vi.mock('@shopify/cli-kit/node/api/admin')
vi.mock('@shopify/cli-kit/node/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/ui')>()
  return {...actual, renderSingleTask: vi.fn(actual.renderSingleTask)}
})

const query = 'query { shop { name } }'
const app = testAppLinked()

beforeEach(() => {
  const remoteApp = testOrganizationApp()
  vi.mocked(prepareExecuteContext).mockResolvedValue({
    query,
    appContextResult: {
      app,
      remoteApp,
      organization: testOrganization(),
      developerPlatformClient: remoteApp.developerPlatformClient,
      project: testProject(),
      specifications: [],
      activeConfig: {} as never,
    },
    store: testOrganizationStore({shopDomain: 'shop.myshopify.com'}),
  })
  vi.mocked(createAdminSessionAsApp).mockResolvedValue({token: 'test-token', storeFqdn: 'shop.myshopify.com'})
  vi.mocked(resolveApiVersion).mockResolvedValue('2026-10')
})

afterEach(() => {
  mockAndCaptureOutput().clear()
  vi.unstubAllEnvs()
})

async function runCommand(flags: string[]) {
  const argv = ['--query', query, '--store', 'shop.myshopify.com', ...flags]
  if (!flags.includes('--json')) {
    vi.mocked(renderSingleTask).mockImplementation(async ({task}) => task(() => {}))
  }
  const command = new Execute(argv, await Config.load())
  return runWithCommandEventsForCommand(argv, () => command.run())
}

test('writes one native GraphQL result with progress events on stderr', async () => {
  const data = {shop_alias: {name: 'Café', enabled: false}, products: [], missing: null}
  const extensions = {cost: {requestedQueryCost: 1}}
  vi.mocked(adminRequestDoc).mockImplementation(async ({responseOptions}) => {
    responseOptions?.onResponse?.({data, extensions, status: 200, headers: new Headers()})
    return data
  })

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await expect(runCommand(['--json'])).resolves.toEqual({app})
    expect(JSON.parse(stdout())).toEqual({data, extensions})
    expect(stdout()).not.toContain('Operation succeeded')
    const events = stderr()
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    expect(events).toEqual([
      expect.objectContaining({type: 'progress', status: 'started', message: 'Authenticating'}),
      expect.objectContaining({type: 'progress', status: 'completed', message: 'Authenticating'}),
      expect.objectContaining({type: 'progress', status: 'started', message: 'Executing GraphQL operation'}),
      expect.objectContaining({type: 'progress', status: 'completed', message: 'Executing GraphQL operation'}),
    ])
  })
  expect(adminRequestDoc).toHaveBeenCalledOnce()
})

test.each([{}, null])('writes an empty or null native data result: %j', async (data) => {
  vi.mocked(adminRequestDoc).mockResolvedValue(data)
  await withCapturedStandardStreams(async ({stdout}) => {
    await runCommand(['--json'])
    expect(JSON.parse(stdout())).toEqual({data})
  })
})

test('preserves raw query data and the success banner in text mode', async () => {
  const data = {shop: {name: 'Test Shop'}}
  vi.mocked(adminRequestDoc).mockResolvedValue(data)
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runCommand([])
    expect(stdout()).toBe(`${JSON.stringify(data, null, 2)}\n`)
    expect(stderr()).toContain('Operation succeeded.')
  })
})

test.each([{json: true}, {json: false}])('writes a real file and the correct stdout receipt: $json', async ({json}) => {
  await inTemporaryDirectory(async (directory) => {
    const outputFile = joinPath(directory, 'result.json')
    const data = {shop: {name: 'Test Shop'}}
    vi.mocked(adminRequestDoc).mockResolvedValue(data)
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runCommand(['--output-file', outputFile, ...(json ? ['--json'] : [])])
      if (json) {
        expect(JSON.parse(stdout())).toEqual({path: resolvePath(outputFile), format: 'json'})
        expect(stderr()).not.toContain('Operation succeeded.')
      } else {
        expect(stdout()).toBe('')
        expect(stderr()).toContain('Results written to')
        expect(stderr()).toContain('result.json')
      }
    })
    await expect(readFile(outputFile)).resolves.toBe(JSON.stringify(json ? {data} : data, null, 2))
  })
})

test('resolves a relative file name in the receipt', async () => {
  await inTemporaryDirectory(async (directory) => {
    const path = joinPath(directory, 'result.json')
    vi.mocked(adminRequestDoc).mockResolvedValue({})
    await withCapturedStandardStreams(async ({stdout}) => {
      await runCommand(['--json', '--output-file', relativePath(cwd(), path)])
      expect(JSON.parse(stdout())).toEqual({path, format: 'json'})
    })
    await expect(readFile(path)).resolves.toBe('{\n  "data": {}\n}')
  })
})

test('keeps native extensions in the written JSON file', async () => {
  await inTemporaryDirectory(async (directory) => {
    const path = joinPath(directory, 'result.json')
    const data = {alias: {name: 'Café'}}
    const extensions = {cost: {requestedQueryCost: 1}}
    vi.mocked(adminRequestDoc).mockImplementation(async ({responseOptions}) => {
      responseOptions?.onResponse?.({data, extensions, status: 200, headers: new Headers()})
      return data
    })
    await withCapturedStandardStreams(async ({stdout}) => {
      await runCommand(['--json', '--output-file', path])
      expect(JSON.parse(stdout())).toEqual({path, format: 'json'})
    })
    await expect(readFile(path)).resolves.toBe(JSON.stringify({data, extensions}, null, 2))
  })
})

test('does not print a receipt when the file cannot be written', async () => {
  await inTemporaryDirectory(async (directory) => {
    const outputFile = joinPath(directory, 'missing', 'result.json')
    vi.mocked(adminRequestDoc).mockResolvedValue({})
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(runCommand(['--json', '--output-file', outputFile])).rejects.toThrow()
      expect(stdout()).toBe('')
    })
  })
})

test('uses one shared fatal error document with native GraphQL details and does not create a file', async () => {
  await inTemporaryDirectory(async (directory) => {
    const outputFile = joinPath(directory, 'result.json')
    const details = {
      errors: [new GraphQLError('Denied', {extensions: {code: 'ACCESS_DENIED'}})],
      data: {shop: null},
      extensions: {cost: {actualQueryCost: 1}},
    }
    vi.mocked(adminRequestDoc).mockRejectedValue(new ClientError({...details, status: 200}, {query}))
    vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      try {
        await runCommand(['--json', '--output-file', outputFile])
        throw new Error('Expected the command to fail')
      } catch (error) {
        if (!(error instanceof AbortError)) throw error
        expect(error).toBeInstanceOf(AbortError)
        await handler(error)
      }
      expect(JSON.parse(stdout())).toEqual({
        error: {type: 'abort', message: 'GraphQL operation failed.', details: JSON.parse(JSON.stringify(details))},
      })
      expect(stderr()).not.toContain('GraphQL operation failed.')
    })
    await expect(fileExists(outputFile)).resolves.toBe(false)
  })
})

test('preserves the text error banner without a fatal error for a GraphQL failure', async () => {
  const errors = [new GraphQLError('Invalid query')]
  vi.mocked(adminRequestDoc).mockRejectedValue(new ClientError({errors, status: 200}, {query}))
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await expect(runCommand([])).resolves.toEqual({app})
    expect(stdout()).toBe('')
    expect(stderr()).toContain('GraphQL operation failed.')
    expect(stderr()).toContain('Invalid query')
  })
})

test('propagates transport failure without printing a success result', async () => {
  vi.mocked(adminRequestDoc).mockRejectedValue(new Error('Network unavailable'))
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await expect(runCommand(['--json'])).rejects.toThrow('Network unavailable')
    expect(stdout()).toBe('')
    expect(
      stderr()
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line)),
    ).toContainEqual(expect.objectContaining({type: 'progress', status: 'failed'}))
  })
})

test.each([{flags: ['--json']}, {flags: ['--no-input']}, {flags: ['--json', '--no-input']}])(
  'keeps output and input flags independent: $flags',
  async ({flags}) => {
    vi.mocked(adminRequestDoc).mockResolvedValue({})
    await withCapturedStandardStreams(async ({stdout}) => {
      await runCommand(flags)
      expect(JSON.parse(stdout())).toEqual(flags.includes('--json') ? {data: {}} : {})
    })
    expect(prepareExecuteContext).toHaveBeenCalledWith(expect.objectContaining({json: flags.includes('--json')}))
  },
)

test('exposes the result and file receipt schemas in help', () => {
  expect(Execute.jsonOutputSchema).toBe(appExecuteJsonOutputSchema)
  expect(Execute.flags).toHaveProperty('json')
  expect(Execute.descriptionForHelp()).toContain('`AppExecuteResult` schema')
  expect(Execute.descriptionForHelp()).toContain('AppExecuteFileReceipt')
})

import Execute from './execute.js'
import {prepareExecuteContext} from '../../utilities/execute-command-helpers.js'
import {createAdminSessionAsApp, resolveApiVersion} from '../../services/graphql/common.js'
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
// eslint-disable-next-line @shopify/typescript-prefer-build-client-schema -- Local execution fixture without an introspection response.
import {GraphQLError, buildSchema, graphql} from 'graphql'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {AbortError, handler} from '@shopify/cli-kit/node/error'
import {unstyled} from '@shopify/cli-kit/node/output'
import {fileExists, inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {joinPath} from '@shopify/cli-kit/node/path'
import * as ui from '@shopify/cli-kit/node/ui'

vi.mock('../../utilities/execute-command-helpers.js')
vi.mock('../../services/graphql/common.js')
vi.mock('@shopify/cli-kit/node/api/admin')

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
  vi.unstubAllEnvs()
})

async function runCommand(flags: string[]) {
  const argv = ['--query', query, '--store', 'shop.myshopify.com', ...flags]
  const command = new Execute(argv, await Config.load())
  const textTask = flags.includes('--json')
    ? undefined
    : vi.spyOn(ui, 'renderSingleTask').mockImplementation(async ({task}) => task(() => {}))
  try {
    return await runWithCommandEventsForCommand(argv, () => command.run())
  } finally {
    textTask?.mockRestore()
  }
}

test('preserves native GraphQL aliases, order, and UTF-8 on stdout and in output files', async () => {
  const response = await graphql({
    schema: buildSchema('type Query { name: String! nested: Query }'),
    source: 'query { last: name __proto__: name constructor: name nested { __proto__: name constructor: name } }',
    rootValue: {name: 'Café', nested: {name: 'Nested'}},
  })
  expect(response.errors).toBeUndefined()
  const extensions = JSON.parse('{"__proto__":{"trace":"preserved"},"constructor":false,"nullable":null,"empty":[]}')
  vi.mocked(adminRequestDoc).mockImplementation(async ({responseOptions}) => {
    responseOptions?.onResponse?.({data: response.data, extensions, status: 200, headers: new Headers()})
    return response.data
  })
  const json = JSON.stringify({data: response.data, extensions}, null, 2)
  const text = JSON.stringify(response.data, null, 2)

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runCommand(['--json'])
    expect(stdout()).toBe(`${json}\n`)
    expect(
      stderr()
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line)),
    ).toEqual([
      expect.objectContaining({type: 'progress', status: 'started', message: 'Authenticating'}),
      expect.objectContaining({type: 'progress', status: 'completed', message: 'Authenticating'}),
      expect.objectContaining({type: 'progress', status: 'started', message: 'Executing GraphQL operation'}),
      expect.objectContaining({type: 'progress', status: 'completed', message: 'Executing GraphQL operation'}),
    ])
  })
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runCommand([])
    expect(stdout()).toBe(`${text}\n`)
    expect(stderr()).toContain('Operation succeeded.')
  })
  await inTemporaryDirectory(async (directory) => {
    const path = joinPath(directory, 'result.json')
    await withCapturedStandardStreams(async ({stdout}) => {
      await runCommand(['--json', '--output-file', path])
      expect(JSON.parse(stdout())).toEqual({path, format: 'json'})
    })
    await expect(readFile(path)).resolves.toBe(json)
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runCommand(['--output-file', path])
      expect(stdout()).toBe('')
      expect(stderr()).toContain('Operation succeeded.')
      expect(unstyled(stderr()).replace(/[│\s]/g, '')).toContain(`Resultswrittento${path}`)
    })
    await expect(readFile(path)).resolves.toBe(text)
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
  const errors = [new GraphQLError('Field invalidField does not exist')]
  vi.mocked(adminRequestDoc).mockRejectedValue(new ClientError({errors, status: 200}, {query}))
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await expect(runCommand([])).resolves.toEqual({app})
    expect(stdout()).toBe('')
    expect(stderr()).toContain('GraphQL operation failed.')
    expect(stderr()).toContain('invalidField')
  })
})

import EnvPull from './pull.js'
import * as envPullService from '../../../services/app/env/pull.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {logMetadataForLoadedContext} from '../../../services/context.js'
import {testAppLinked, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {OrganizationSource} from '../../../models/organization.js'
import {appEnvPullJsonOutputSchema} from '../../../services/app/env/pull/types.js'
import {Config} from '@oclif/core'
import {expect, test, vi} from 'vitest'
import {inTemporaryDirectory, writeFile, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath, resolvePath} from '@shopify/cli-kit/node/path'
import * as context from '@shopify/cli-kit/node/context/local'
import {mockAndCaptureStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'

vi.mock('../../../services/app-context.js')
vi.mock('../../../services/context.js')

const variables = {SHOPIFY_API_KEY: 'api-key', SHOPIFY_API_SECRET: 'api-secret', SCOPES: 'read_products'}
const content = 'SHOPIFY_API_KEY=api-key\nSHOPIFY_API_SECRET=api-secret\nSCOPES=read_products'

function setup(directory: string, secret: string | undefined = 'api-secret') {
  const app = testAppLinked({
    directory,
    configuration: {...testAppLinked().configuration, access_scopes: {scopes: 'read_products'}},
  })
  const remoteApp = testOrganizationApp({apiSecretKeys: secret === undefined ? [] : [{secret}]})
  const organization = {id: '1', businessName: 'Example', source: OrganizationSource.BusinessPlatform}
  vi.mocked(linkedAppContext).mockResolvedValue({app, remoteApp, organization} as Awaited<
    ReturnType<typeof linkedAppContext>
  >)
  return {app, remoteApp, organization}
}

test.each([
  {initial: undefined, status: 'created', expected: content},
  {initial: content, status: 'unchanged', expected: content},
  {
    initial: `# Keep me\nCUSTOM=value\n${content.replace('api-key', 'old-key')}`,
    status: 'updated',
    expected: `# Keep me\nCUSTOM=value\n${content}`,
  },
])(
  'returns $status with the actual file contents and no terminal diff on stdout',
  async ({initial, status, expected}) => {
    await inTemporaryDirectory(async (directory) => {
      const {app, remoteApp, organization} = setup(directory)
      const path = joinPath(directory, '.env.custom')
      if (initial !== undefined) await writeFile(path, initial)
      const command = new EnvPull(['--path', directory, '--env-file', '.env.custom', '--json'], await Config.load())
      vi.spyOn(context, 'isUnitTest').mockReturnValue(false)
      const streams = mockAndCaptureStandardStreams()
      try {
        await expect(runWithCommandEventsForCommand(['--json'], () => command.run())).resolves.toEqual({app})
        expect(streams.stdout()).toBe(`${JSON.stringify({path, status, variables, content: expected}, null, 2)}\n`)
        expect(streams.stderr()).toBe('')
        expect(logMetadataForLoadedContext).toHaveBeenCalledExactlyOnceWith(remoteApp, organization.source)
      } finally {
        streams.restore()
      }
      await expect(readFile(path)).resolves.toBe(expected)
    })
  },
)

test('does not emit a result when the environment file cannot be read', async () => {
  await inTemporaryDirectory(async (directory) => {
    setup(directory)
    const command = new EnvPull(['--path', directory, '--env-file', directory, '--json'], await Config.load())
    vi.spyOn(context, 'isUnitTest').mockReturnValue(false)
    const streams = mockAndCaptureStandardStreams()
    try {
      await expect(command.run()).rejects.toThrow()
      expect(streams.stdout()).toBe('')
    } finally {
      streams.restore()
    }
  })
})

test('exposes the schema, JSON flag and existing file selection flag', () => {
  expect(EnvPull.jsonOutputSchema).toBe(appEnvPullJsonOutputSchema)
  expect(EnvPull.description).toContain('AppEnvPullResult')
  expect(EnvPull.flags.json).toBeDefined()
  expect(EnvPull.flags['env-file']).toBeDefined()
})

test.each([
  {path: 1, status: 'created', variables, content},
  {path: '/app/.env', status: 'failed', variables, content},
  {path: '/app/.env', status: 'updated', variables: {...variables, SCOPES: null}, content},
  {path: '/app/.env', status: 'unchanged', variables, content: null},
])('rejects malformed data %j', (value) => {
  expect(() => appEnvPullJsonOutputSchema.validate(value)).toThrow()
})

test('uses Windows absolute --env-file paths as-is', async () => {
  const directory = joinPath('F:', 'Project', 'cherhomeliving.shopify', 'shopify-app')
  const {app, remoteApp, organization} = setup(directory)
  const envFile = joinPath(directory, '.env')
  const pull = vi
    .spyOn(envPullService, 'pullEnv')
    .mockResolvedValue({result: {path: envFile, status: 'created', variables, content}, previousContent: null})
  await new EnvPull(['--path', directory, '--env-file', envFile], await Config.load()).run()
  expect(pull).toHaveBeenCalledWith({app, remoteApp, organization, envFile})
})

test('resolves nested relative --env-file paths from the app directory', async () => {
  await inTemporaryDirectory(async (directory) => {
    const {app, remoteApp, organization} = setup(directory)
    const envFile = resolvePath(directory, 'config/.env')
    const pull = vi
      .spyOn(envPullService, 'pullEnv')
      .mockResolvedValue({result: {path: envFile, status: 'created', variables, content}, previousContent: null})
    await new EnvPull(['--path', directory, '--env-file', 'config/.env'], await Config.load()).run()
    expect(pull).toHaveBeenCalledWith({app, remoteApp, organization, envFile})
  })
})

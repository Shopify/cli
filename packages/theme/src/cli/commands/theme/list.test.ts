import List from './list.js'
import {list} from '../../services/list.js'
import {themeListJsonOutputSchema} from '../../services/list/types.js'
import {themeResultJsonSchema} from '../../services/json-output/schema.test-data.js'
import {afterEach, expect, test, vi} from 'vitest'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {mockAndCaptureStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {AbortError} from '@shopify/cli-kit/node/error'

vi.mock('../../services/list.js')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/environments')

const theme = {id: 1, name: 'Dawn', processing: false, createdAtRuntime: false, role: 'live'}
const publicTheme = {id: '1', name: 'Dawn', role: 'live', processing: false}

afterEach(() => vi.unstubAllEnvs())

function restoreExitCode(value: typeof process.exitCode): void {
  process.exitCode = value
}

test('preserves false fields and rejects invalid themes', () => {
  expect(JSON.parse(themeListJsonOutputSchema.encode([theme]))).toEqual({themes: [publicTheme]})
  expect(JSON.parse(themeListJsonOutputSchema.encode([]))).toEqual({themes: []})
  expect(() => themeListJsonOutputSchema.validate({themes: [{...publicTheme, id: 1}]})).toThrow()
  expect(() => themeListJsonOutputSchema.validate({themes: [{...publicTheme, processing: null}]})).toThrow()
})

const listSession = {storeFqdn: 'shop.myshopify.com', token: 'token'}

// Registered before the module-reset tests below so the suite shares this file's mocked modules.
describeJsonCommand({
  command: List,
  commandId: 'theme:list',
  moduleURL: new URL('../../../../../cli/src/index.ts', import.meta.url).href,
  args: ['--store=shop.myshopify.com', '--password=token'],
  expectedResult: {themes: [publicTheme]},
  expectedSchema: themeResultJsonSchema,
  setup: () => {
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(listSession)
    vi.mocked(list).mockResolvedValue([theme])
  },
  assertExecuted: (format) => {
    expect(ensureAuthenticatedThemes).toHaveBeenCalledExactlyOnceWith(listSession.storeFqdn, 'token')
    expect(list).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({json: format === 'json'}), listSession)
  },
  assertNotExecuted: () => {
    expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
    expect(list).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain('Dawn')
    expect(stderr).toContain('[live]')
    expect(stderr).toContain('#1')
  },
  failure: {
    setup: () => {
      vi.mocked(list).mockRejectedValue(new AbortError('Fetch failed.'))
    },
    expectedError: {error: {type: 'abort', message: 'Fetch failed.'}},
    exitCode: 1,
  },
})

test.each(['single', 'named single', 'multiple', 'partial failure', 'total failure'])(
  'writes one final document to stdout for %s environments',
  async (mode) => {
    vi.stubEnv('SHOPIFY_UNIT_TEST', 'false')
    vi.resetModules()
    const {default: StreamList} = await import('./list.js')
    const {list: listService} = await import('../../services/list.js')
    const {ensureAuthenticatedThemes: authenticate} = await import('@shopify/cli-kit/node/session')
    const {loadEnvironment: load} = await import('@shopify/cli-kit/node/environments')
    const {runWithCommandEventsForCommand} = await import('@shopify/cli-kit/node/command-events')
    const {Config: StreamConfig} = await import('@oclif/core')
    const config = new StreamConfig({root: __dirname})
    await config.load()
    vi.mocked(authenticate).mockImplementation(async (store) => ({storeFqdn: store, token: 'token'}))
    vi.mocked(load).mockImplementation(async (environment) => ({
      store: `${environment}.myshopify.com`,
      password: 'token',
    }))
    vi.mocked(listService).mockImplementation(async (_flags, session) => {
      if (mode === 'total failure' || (mode === 'partial failure' && session.storeFqdn.startsWith('first'))) {
        throw new Error('Fetch failed')
      }
      // Complete in reverse order to prove that completion order does not affect output.
      if (session.storeFqdn.startsWith('first')) await new Promise((resolve) => setTimeout(resolve, 10))
      return [theme]
    })
    const streams = mockAndCaptureStandardStreams()
    const originalExitCode = process.exitCode
    try {
      const namedEnvironments = mode === 'named single' ? ['first'] : ['first', 'second']
      const args =
        mode === 'single'
          ? ['--store=single.myshopify.com', '--password=token']
          : namedEnvironments.map((environment) => `--environment=${environment}`)
      const argv = [...args, '--json']
      await runWithCommandEventsForCommand(argv, () => new StreamList(argv, config).run())
      if (mode.includes('failure')) expect(process.exitCode).toBe(1)
    } finally {
      streams.restore()
      restoreExitCode(originalExitCode)
    }
    let successfulEnvironments = ['first', 'second']
    if (mode === 'total failure') successfulEnvironments = []
    if (mode === 'partial failure') successfulEnvironments = ['second']
    const expected =
      mode === 'single'
        ? {themes: [publicTheme]}
        : {
            environments: (mode === 'named single' ? ['first'] : ['first', 'second']).map((environment) =>
              successfulEnvironments.includes(environment)
                ? {environment, result: {themes: [publicTheme]}}
                : {environment, error: {type: 'bug', message: 'Fetch failed', stack: expect.any(String)}},
            ),
          }
    expect(streams.stdout()).toBe(`${JSON.stringify(JSON.parse(streams.stdout()), null, 2)}\n`)
    expect(JSON.parse(streams.stdout())).toEqual(expected)
    if (mode.includes('failure')) {
      expect(streams.stderr()).toContain('Fetch failed')
      const events = streams
        .stderr()
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
      expect(events.every((event) => event.type === 'diagnostic')).toBe(true)
    } else expect(streams.stderr()).toBe('')
  },
)

import List from './list.js'
import {list} from '../../services/list.js'
import {themeListJsonOutputSchema} from '../../services/list/types.js'
import {captureStandardStreams} from '../../utilities/testing/streams.js'
import {Config} from '@oclif/core'
import {afterEach, expect, test, vi} from 'vitest'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('../../services/list.js')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/environments')

const theme = {id: 1, name: 'Dawn', processing: false, createdAtRuntime: false, role: 'live'}
const publicTheme = {id: '1', name: 'Dawn', role: 'live', processing: false}

afterEach(() => vi.unstubAllEnvs())

function restoreExitCode(value: typeof process.exitCode): void {
  process.exitCode = value
}

test('exposes the schema, preserves false fields and rejects invalid themes', () => {
  expect(List.jsonOutputSchema).toBe(themeListJsonOutputSchema)
  expect(List.flags.json).toBeDefined()
  expect(JSON.parse(themeListJsonOutputSchema.encode([theme]))).toEqual({themes: [publicTheme]})
  expect(JSON.parse(themeListJsonOutputSchema.encode([]))).toEqual({themes: []})
  expect(() => themeListJsonOutputSchema.validate({themes: [{...publicTheme, id: 1}]})).toThrow()
  expect(() => themeListJsonOutputSchema.validate({themes: [{...publicTheme, processing: null}]})).toThrow()
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
    const streams = captureStandardStreams()
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
                : {environment, error: {type: 'abort', message: 'Fetch failed'}},
            ),
          }
    expect(streams.stdout()).toBe(`${JSON.stringify(expected, null, 2)}\n`)
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

test('propagates a single-environment failure without producing a result', async () => {
  const output = mockAndCaptureOutput()
  const config = new Config({root: __dirname})
  await config.load()
  vi.mocked(ensureAuthenticatedThemes).mockResolvedValue({storeFqdn: 'shop.myshopify.com', token: 'token'})
  vi.mocked(list).mockRejectedValue(new Error('Fetch failed'))
  await expect(new List(['--store=shop.myshopify.com', '--password=token', '--json'], config).run()).rejects.toThrow(
    'Fetch failed',
  )
  expect(output.output()).toBe('')
})

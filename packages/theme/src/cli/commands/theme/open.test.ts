import Open from './open.js'
import {open} from '../../services/open.js'
import {themeOpenJsonOutputSchema, type ThemeOpenResult} from '../../services/open/types.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {Config} from '@oclif/core'
import {afterEach, expect, test, vi} from 'vitest'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {openURL} from '@shopify/cli-kit/node/system'
import {renderConcurrent, renderError, renderInfo} from '@shopify/cli-kit/node/ui'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {loadEnvironment} from '@shopify/cli-kit/node/environments'

vi.mock('../../services/open.js')
vi.mock('../../utilities/theme-store.js')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/system', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/system')>()),
  openURL: vi.fn(async () => true),
}))
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/environments')
vi.mock('@shopify/cli-kit/node/analytics')
vi.mock('@shopify/cli-kit/node/metadata')

const session = {token: 'token', storeFqdn: 'store.myshopify.com'}

afterEach(() => vi.unstubAllEnvs())

const result: ThemeOpenResult = {
  theme: {id: 1, name: 'my theme', role: 'live', processing: false, createdAtRuntime: false},
  preview_url: 'https://store.myshopify.com?preview_theme_id=1',
  editor_url: 'https://store.myshopify.com/admin/themes/1/editor',
}

async function run(argv: string[]) {
  const config = new Config({root: __dirname})
  await config.load()
  vi.mocked(ensureThemeStore).mockReturnValue(session.storeFqdn)
  vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(session)
  await new Open(['--store=store.myshopify.com', ...argv], config).run()
}

const publicResult = {
  theme: {
    id: '1',
    name: 'my theme',
    role: 'live',
    storeDomain: 'store.myshopify.com',
    previewUrl: 'https://store.myshopify.com?preview_theme_id=1',
    editorUrl: 'https://store.myshopify.com/admin/themes/1/editor',
    processing: false,
    sourceUrl: null,
  },
}

test('exposes the result schema and JSON flag in help', () => {
  expect(Open.jsonOutputSchema).toBe(themeOpenJsonOutputSchema)
  expect(Open.flags.json).toBeDefined()
  expect(Open.description).toContain('ThemeOpenResult')
  expect(Open.description).toContain('previewUrl')
})

test.each([false, true])('preserves browser selection with editor=%s', async (editor) => {
  vi.mocked(open).mockResolvedValue(result)

  await run(['--theme=1', ...(editor ? ['--editor'] : [])])

  expect(renderInfo).toHaveBeenCalled()
  expect(openURL).toHaveBeenCalledWith(editor ? result.editor_url : result.preview_url)
})

test('writes one JSON result', async () => {
  vi.mocked(open).mockResolvedValue(result)

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await run(['--theme=1', '--json'])

    expect(JSON.parse(stdout())).toEqual(publicResult)
    expect(stderr()).toBe('')
  })
  expect(renderInfo).not.toHaveBeenCalled()
  expect(openURL).toHaveBeenCalledWith(result.preview_url)
  expect(open).toHaveBeenCalledWith(session, expect.objectContaining({theme: '1', json: true}))
})

test.each(
  ['CODESPACES', 'GITPOD_WORKSPACE_URL', 'CLOUD_SHELL'].flatMap((platform) =>
    ['text', 'json', 'environments'].map((mode) => ({platform, mode})),
  ),
)('returns links in $mode mode when browser opening is skipped in $platform', async ({platform, mode}) => {
  vi.stubEnv(platform, '1')
  const {openURL: actualOpenURL} =
    await vi.importActual<typeof import('@shopify/cli-kit/node/system')>('@shopify/cli-kit/node/system')
  vi.mocked(openURL).mockImplementation(actualOpenURL)
  vi.mocked(open).mockResolvedValue(result)
  vi.mocked(loadEnvironment).mockResolvedValue({store: session.storeFqdn, password: 'token', theme: '1'})

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    const argv = mode === 'environments' ? ['--json', '-e', 'staging', '-e', 'production'] : ['--theme=1']
    if (mode === 'json') argv.push('--json')
    await run(argv)

    if (mode === 'text') {
      expect(renderInfo).toHaveBeenCalled()
    } else {
      expect(JSON.parse(stdout())).toEqual(
        mode === 'json'
          ? publicResult
          : {environments: ['staging', 'production'].map((environment) => ({environment, result: publicResult}))},
      )
    }
    expect(stderr()).toBe('')
  })
  expect(openURL).toHaveBeenCalledWith(result.preview_url)
})

test.each([false, true])('collects ordered environment results with browser failure=%s', async (browserFailure) => {
  const previousExitCode = process.exitCode
  try {
    vi.mocked(loadEnvironment).mockResolvedValue({store: session.storeFqdn, password: 'token', theme: '1'})
    vi.mocked(open).mockResolvedValue(result)
    vi.mocked(openURL).mockResolvedValueOnce(true).mockResolvedValueOnce(!browserFailure)

    await withCapturedStandardStreams(async ({stdout}) => {
      await run(['--json', '-e', 'staging', '-e', 'production'])

      const output = JSON.parse(stdout())
      expect(output).toEqual({
        environments: [
          {environment: 'staging', result: publicResult},
          browserFailure
            ? {environment: 'production', error: expect.objectContaining({message: 'Could not open the browser.'})}
            : {environment: 'production', result: publicResult},
        ],
      })
      expect(() => themeOpenJsonOutputSchema.validate(output)).not.toThrow()
    })
    expect(openURL).toHaveBeenCalledTimes(2)
    expect(open).toHaveBeenCalledTimes(2)
    if (browserFailure) expect(process.exitCode).toBe(1)
  } finally {
    // eslint-disable-next-line require-atomic-updates
    process.exitCode = previousExitCode
  }
})

test.each(['none', 'selection', 'browser'])('sets the text batch exit status with failure=%s', async (failure) => {
  const previousExitCode = process.exitCode
  process.exitCode = 0
  try {
    vi.mocked(loadEnvironment).mockResolvedValue({store: session.storeFqdn, password: 'token', theme: '1'})
    vi.mocked(open).mockResolvedValue(result)
    vi.mocked(openURL).mockResolvedValue(true)
    if (failure === 'selection') vi.mocked(open).mockRejectedValueOnce(new Error('Theme not found'))
    if (failure === 'browser') vi.mocked(openURL).mockResolvedValueOnce(false)
    vi.mocked(renderConcurrent).mockImplementation(async ({processes}) => {
      await Promise.all(
        processes.map(({action}) => action(process.stdout, process.stderr, new AbortController().signal)),
      )
    })

    await run(['-e', 'staging', '-e', 'production'])

    expect(open).toHaveBeenCalledTimes(2)
    expect(process.exitCode).toBe(failure === 'none' ? 0 : 1)
    if (failure === 'none') {
      expect(renderError).not.toHaveBeenCalled()
    } else {
      expect(renderError).toHaveBeenCalledWith({
        body: [
          `Environment staging failed: \n\n${failure === 'selection' ? 'Theme not found' : 'Could not open the browser.'}`,
        ],
      })
    }
  } finally {
    process.exitCode = previousExitCode
  }
})

test('propagates selection errors without opening the browser or rendering a result', async () => {
  const error = new Error('Theme not found')
  vi.mocked(open).mockRejectedValue(error)

  await expect(run(['--theme=1', '--json'])).rejects.toBe(error)

  expect(openURL).not.toHaveBeenCalled()
  expect(renderInfo).not.toHaveBeenCalled()
})

test('propagates browser failures before emitting the JSON result', async () => {
  vi.mocked(open).mockResolvedValue(result)
  const error = new Error('Browser unavailable')
  vi.mocked(openURL).mockRejectedValue(error)

  await withCapturedStandardStreams(async ({stdout}) => {
    await expect(run(['--theme=1', '--json'])).rejects.toBe(error)

    expect(stdout()).toBe('')
  })
})

test('rejects an unsuccessful browser launch without emitting a JSON result', async () => {
  vi.mocked(open).mockResolvedValue(result)
  vi.mocked(openURL).mockResolvedValue(false)

  await withCapturedStandardStreams(async ({stdout}) => {
    await expect(run(['--theme=1', '--json'])).rejects.toThrow('Could not open the browser.')
    expect(stdout()).toBe('')
  })
})

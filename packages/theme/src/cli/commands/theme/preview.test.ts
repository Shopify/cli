import Preview from './preview.js'
import {themePreviewJsonOutputSchema} from '../../services/dev-override/types.js'
import {devWithOverrideFile} from '../../services/dev-override.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {openURL} from '@shopify/cli-kit/node/system'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {recordEvent} from '@shopify/cli-kit/node/analytics'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {Config} from '@oclif/core'
import {describe, vi, expect, test, beforeEach} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/system', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/system')>()),
  openURL: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/analytics', () => ({
  recordEvent: vi.fn(),
  compileData: vi.fn().mockReturnValue({timings: {}, errors: {}, retries: {}, events: {}}),
}))
vi.mock('@shopify/cli-kit/node/metadata', () => ({
  addPublicMetadata: vi.fn(),
  addSensitiveMetadata: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/environments')
vi.mock('../../services/dev-override.js')
vi.mock('../../utilities/theme-selector.js')
vi.mock('../../utilities/theme-store.js')

const CommandConfig = new Config({root: __dirname})

const result = {url: 'https://abc123.shopifypreview.com', preview_identifier: 'abc123'}

const adminSession = {token: 'test-token', storeFqdn: 'test-store.myshopify.com'}
const namedTheme = buildTheme({id: 2, name: 'My Theme', role: 'unpublished'})!

async function run(argv: string[]) {
  await CommandConfig.load()
  const command = new Preview(['--store=test-store.myshopify.com', ...argv], CommandConfig)
  await command.run()
}

describe('Preview', () => {
  beforeEach(() => {
    vi.mocked(ensureThemeStore).mockReturnValue('test-store.myshopify.com')
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(adminSession)
    vi.mocked(findOrSelectTheme).mockResolvedValue(namedTheme)
    vi.mocked(devWithOverrideFile).mockResolvedValue(result)
  })

  test('calls devWithOverrideFile with minimum options passed into the command', async () => {
    const expectedTheme = buildTheme({id: 5, name: 'Expected Theme', role: 'unpublished'})!
    vi.mocked(findOrSelectTheme).mockResolvedValue(expectedTheme)

    await run(['--overrides=/path/to/overrides.json', `--theme=${expectedTheme.id}`])

    expect(devWithOverrideFile).toHaveBeenCalledWith(
      expect.objectContaining({
        adminSession,
        overrideJson: '/path/to/overrides.json',
        themeId: expectedTheme.id.toString(),
      }),
    )
  })

  test('passes --preview-id to devWithOverrideFile when provided', async () => {
    const expectedTheme = buildTheme({id: 5, name: 'Expected Theme', role: 'unpublished'})!
    vi.mocked(findOrSelectTheme).mockResolvedValue(expectedTheme)

    await run(['--overrides=/path/to/overrides.json', `--theme=${expectedTheme.id}`, '--preview-id=abc123'])

    expect(devWithOverrideFile).toHaveBeenCalledWith(
      expect.objectContaining({
        themeId: expectedTheme.id.toString(),
        previewIdentifier: 'abc123',
      }),
    )
  })

  test('opens the resulting preview when requested', async () => {
    vi.mocked(openURL).mockResolvedValue(true)
    const expectedTheme = buildTheme({id: 5, name: 'Expected Theme', role: 'unpublished'})!
    vi.mocked(findOrSelectTheme).mockResolvedValue(expectedTheme)

    await run(['--overrides=/path/to/overrides.json', `--theme=${expectedTheme.id}`, '--open'])

    expect(openURL).toHaveBeenCalledWith(result.url)

    expect(devWithOverrideFile).toHaveBeenCalledWith(
      expect.objectContaining({
        themeId: expectedTheme.id.toString(),
      }),
    )
  })

  test('records the preview authenticated event', async () => {
    const expectedTheme = buildTheme({id: 5, name: 'Expected Theme', role: 'unpublished'})!
    vi.mocked(findOrSelectTheme).mockResolvedValue(expectedTheme)

    await run(['--overrides=/path/to/overrides.json', `--theme=${expectedTheme.id}`])

    expect(recordEvent).toHaveBeenCalledWith('theme-command:preview:single-env:authenticated')
  })

  test('passes --password to devWithOverrideFile when provided', async () => {
    const expectedTheme = buildTheme({id: 5, name: 'Expected Theme', role: 'unpublished'})!
    vi.mocked(findOrSelectTheme).mockResolvedValue(expectedTheme)

    await run(['--overrides=/path/to/overrides.json', `--theme=${expectedTheme.id}`, '--password=shptka_abc123'])

    expect(devWithOverrideFile).toHaveBeenCalledWith(
      expect.objectContaining({
        themeId: expectedTheme.id.toString(),
        password: 'shptka_abc123',
      }),
    )
  })

  test('preserves the existing JSON output channel through the real presenter and writer', async () => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runWithCommandEventsForCommand(['--json'], () =>
        run(['--overrides=/path/to/overrides.json', '--theme=2', '--json']),
      )

      expect(stdout()).toBe('')
      expect(JSON.parse(stderr())).toMatchObject({
        type: 'diagnostic',
        level: 'info',
        message: JSON.stringify(result),
      })
    })
    expect(renderSuccess).not.toHaveBeenCalled()
    expect(openURL).not.toHaveBeenCalled()
    expect(devWithOverrideFile).toHaveBeenCalledWith({
      adminSession,
      overrideJson: '/path/to/overrides.json',
      themeId: '2',
      previewIdentifier: undefined,
      password: undefined,
    })
  })

  test('exposes its result schema in help', () => {
    expect(Preview.jsonOutputSchema).toBe(themePreviewJsonOutputSchema)
    expect(Preview.description).toContain('ThemePreviewResult')
    expect(Preview.description).toContain('preview_identifier')
    expect(Preview.flags.json.env).toBe('SHOPIFY_FLAG_JSON')
  })

  test('propagates failures without printing a success result or opening a browser', async () => {
    const error = new Error('Failed to parse override file')
    vi.mocked(devWithOverrideFile).mockRejectedValue(error)

    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await expect(run(['--overrides=/path/to/overrides.json', '--theme=2', '--json', '--open'])).rejects.toBe(error)

      expect(stdout()).toBe('')
      expect(stderr()).toBe('')
    })

    expect(renderSuccess).not.toHaveBeenCalled()
    expect(openURL).not.toHaveBeenCalled()
  })

  test('keeps browser failures nonfatal and sends a typed warning to stderr', async () => {
    const error = new Error('Browser unavailable')
    vi.mocked(openURL).mockRejectedValue(error)

    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runWithCommandEventsForCommand(['--json'], () =>
        run(['--overrides=/path/to/overrides.json', '--theme=2', '--json', '--open']),
      )

      const events = stderr()
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
      expect(events).toMatchObject([
        {type: 'diagnostic', level: 'info', message: JSON.stringify(result)},
        {type: 'diagnostic', level: 'warning', message: `Failed to open theme preview.\n${error.stack}`},
      ])
      expect(stdout()).toBe('')
    })
  })
})

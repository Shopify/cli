import Preview from './preview.js'
import {devWithOverrideFile} from '../../services/dev-override.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {recordEvent} from '@shopify/cli-kit/node/analytics'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {Config} from '@oclif/core'
import {describe, vi, expect, test, beforeEach} from 'vitest'

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
    vi.mocked(devWithOverrideFile).mockResolvedValue(undefined)
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
        open: false,
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

  test('passes --open to devWithOverrideFile when provided', async () => {
    const expectedTheme = buildTheme({id: 5, name: 'Expected Theme', role: 'unpublished'})!
    vi.mocked(findOrSelectTheme).mockResolvedValue(expectedTheme)

    await run(['--overrides=/path/to/overrides.json', `--theme=${expectedTheme.id}`, '--open'])

    expect(devWithOverrideFile).toHaveBeenCalledWith(
      expect.objectContaining({
        themeId: expectedTheme.id.toString(),
        open: true,
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

  test('passes --json to devWithOverrideFile when provided', async () => {
    const expectedTheme = buildTheme({id: 5, name: 'Expected Theme', role: 'unpublished'})!
    vi.mocked(findOrSelectTheme).mockResolvedValue(expectedTheme)

    await run(['--overrides=/path/to/overrides.json', `--theme=${expectedTheme.id}`, '--json'])

    expect(devWithOverrideFile).toHaveBeenCalledWith(
      expect.objectContaining({
        themeId: expectedTheme.id.toString(),
        json: true,
      }),
    )
  })
})

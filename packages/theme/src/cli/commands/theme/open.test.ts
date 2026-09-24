import Open from './open.js'
import {open} from '../../services/open.js'
import {themeOpenJsonOutputSchema, type ThemeOpenResult} from '../../services/open/types.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {Config} from '@oclif/core'
import {expect, test, vi} from 'vitest'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {openURL} from '@shopify/cli-kit/node/system'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'

vi.mock('../../services/open.js')
vi.mock('../../utilities/theme-store.js')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/system', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/system')>()),
  openURL: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/environments')
vi.mock('@shopify/cli-kit/node/analytics')
vi.mock('@shopify/cli-kit/node/metadata')

const session = {token: 'token', storeFqdn: 'store.myshopify.com'}
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

test('exposes the result schema and JSON flag in help', () => {
  expect(Open.jsonOutputSchema).toBe(themeOpenJsonOutputSchema)
  expect(Open.flags.json).toBeDefined()
  expect(Open.description).toContain('ThemeOpenResult')
  expect(Open.description).toContain('preview_url')
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

    expect(JSON.parse(stdout())).toEqual(result)
    expect(stderr()).toBe('')
  })
  expect(renderInfo).not.toHaveBeenCalled()
  expect(openURL).toHaveBeenCalledWith(result.preview_url)
  expect(open).toHaveBeenCalledWith(session, expect.objectContaining({theme: '1', json: true}))
})

test('propagates selection errors without opening the browser or rendering a result', async () => {
  const error = new Error('Theme not found')
  vi.mocked(open).mockRejectedValue(error)

  await expect(run(['--theme=1', '--json'])).rejects.toBe(error)

  expect(openURL).not.toHaveBeenCalled()
  expect(renderInfo).not.toHaveBeenCalled()
})

test('preserves browser failures after writing the result', async () => {
  vi.mocked(open).mockResolvedValue(result)
  const error = new Error('Browser unavailable')
  vi.mocked(openURL).mockRejectedValue(error)

  await withCapturedStandardStreams(async ({stdout}) => {
    await expect(run(['--theme=1', '--json'])).rejects.toBe(error)

    expect(JSON.parse(stdout())).toEqual(result)
  })
})

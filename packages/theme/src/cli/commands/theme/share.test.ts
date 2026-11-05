import Share from './share.js'
import {executeThemePush} from '../../services/push.js'
import {themeShareJsonOutputSchema} from '../../services/share/types.js'
import {themeResultJsonSchema} from '../../services/json-output/schema.test-data.js'
import {Config} from '@oclif/core'
import {getRandomName} from '@shopify/cli-kit/common/string'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../services/push.js')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('../../utilities/theme-store.js', () => ({ensureThemeStore: ({store}: {store: string}) => store}))
vi.mock('@shopify/cli-kit/common/string', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/common/string')>()),
  getRandomName: vi.fn(),
}))

const session = {storeFqdn: 'test.myshopify.com', token: 'token'}

function result() {
  return {
    theme: {
      id: 1,
      name: 'Creative Theme',
      role: 'unpublished',
      shop: session.storeFqdn,
      editor_url: 'https://test.myshopify.com/admin/themes/1/editor',
      preview_url: 'https://test.myshopify.com?preview_theme_id=1',
    },
    published: false,
    hasErrors: false,
    errors: {},
  }
}

describe('theme share', () => {
  test('creates an unpublished theme with a random name and forwards the listing', async () => {
    vi.mocked(getRandomName).mockReturnValue('Creative Theme')
    vi.mocked(executeThemePush).mockResolvedValue(result())
    const command = new Share([], new Config({root: '.'}))
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await command.command({json: true, path: '/theme', listing: 'preset'} as never, session, false)

      expect(getRandomName).toHaveBeenCalledWith('creative')
      expect(executeThemePush).toHaveBeenCalledWith(
        expect.objectContaining({unpublished: true, theme: 'Creative Theme', path: '/theme', listing: 'preset'}),
        session,
        false,
        undefined,
      )
      expect(stdout()).toBe(`${themeShareJsonOutputSchema.encode(result())}\n`)
      expect(stderr()).toBe('')
    })
  })

  test('keeps upload errors and environment in JSON', async () => {
    vi.mocked(executeThemePush).mockResolvedValue({
      ...result(),
      environment: 'staging',
      hasErrors: true,
      errors: {'assets/theme.css': ['bad CSS']},
    })
    const command = new Share([], new Config({root: '.'}))
    await withCapturedStandardStreams(async ({stdout}) => {
      await command.command({json: true, environment: ['staging']} as never, session, false)

      expect(JSON.parse(stdout())).toMatchObject({
        status: 'partial',
        changed: true,
        theme: {id: '1'},
        issues: [{message: 'bad CSS'}],
      })
      expect(process.exitCode).toBe(1)
      process.exitCode = 0
    })
  })

  test('does not emit a result when cancelled', async () => {
    vi.mocked(executeThemePush).mockResolvedValue(undefined)
    await withCapturedStandardStreams(async ({stdout}) => {
      await new Share([], new Config({root: '.'})).command({json: true} as never, session, false)

      expect(JSON.parse(stdout())).toEqual({status: 'cancelled'})
    })
  })

  test.each([{id: '1'}, {role: null}, {errors: {file: 'invalid'}}])('rejects malformed theme data %j', (fields) => {
    expect(() =>
      themeShareJsonOutputSchema.validate({status: 'success', theme: {...result().theme, ...fields}}),
    ).toThrow()
  })
})

describeJsonCommand({
  command: Share,
  commandId: 'theme:share',
  moduleURL: new URL('../../../../../cli/src/index.ts', import.meta.url).href,
  args: ['--store', session.storeFqdn, '--password', 'token', '--listing', 'preset'],
  expectedResult: {
    status: 'success',
    changed: true,
    theme: {
      id: '1',
      name: 'Creative Theme',
      role: 'unpublished',
      storeDomain: session.storeFqdn,
      previewUrl: 'https://test.myshopify.com?preview_theme_id=1',
      editorUrl: 'https://test.myshopify.com/admin/themes/1/editor',
    },
    issues: [],
  },
  expectedSchema: themeResultJsonSchema,
  setup: () => {
    vi.mocked(getRandomName).mockReturnValue('Creative Theme')
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(session)
    vi.mocked(executeThemePush).mockResolvedValue(result())
  },
  assertExecuted: () => {
    expect(getRandomName).toHaveBeenCalledExactlyOnceWith('creative')
    expect(ensureAuthenticatedThemes).toHaveBeenCalledExactlyOnceWith(session.storeFqdn, 'token')
    expect(executeThemePush).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        unpublished: true,
        theme: 'Creative Theme',
        store: session.storeFqdn,
        password: 'token',
        listing: 'preset',
      }),
      session,
      false,
      undefined,
    )
  },
  assertNotExecuted: () => {
    expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
    expect(executeThemePush).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain("The theme 'Creative Theme' (#1) was pushed successfully.")
    expect(stderr).toContain('View your theme')
    expect(stderr).toContain('Customize your theme at the theme editor')
  },
  diagnostics: {
    setup: () => {
      vi.mocked(executeThemePush).mockImplementation(async () => {
        outputInfo('Uploading theme files')
        return result()
      })
    },
    expectedEvents: [{type: 'diagnostic', level: 'info', message: 'Uploading theme files'}],
  },
  failure: {
    setup: () => {
      vi.mocked(executeThemePush).mockRejectedValue(new AbortError('Theme creation failed.'))
    },
    expectedError: {error: {type: 'abort', message: 'Theme creation failed.'}},
    exitCode: 1,
  },
})

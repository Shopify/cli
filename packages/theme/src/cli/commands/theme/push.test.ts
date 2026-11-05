import Push from './push.js'
import {executeThemePush} from '../../services/push.js'
import {checkThemeBeforePush} from '../../services/push/result.js'
import {themeResultJsonSchema} from '../../services/json-output/schema.test-data.js'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {describe, expect, test, vi} from 'vitest'
import {Config} from '@oclif/core'
import {AbortError} from '@shopify/cli-kit/node/error'

vi.mock('../../services/push.js')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('../../utilities/theme-store.js', () => ({ensureThemeStore: ({store}: {store: string}) => store}))
vi.mock('../../services/push/result.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/push/result.js')>()),
  checkThemeBeforePush: vi.fn(),
}))

const session = {storeFqdn: 'test.myshopify.com', token: 'token'}

describe('theme push JSON', () => {
  test('retains cancellation without emitting a success result', async () => {
    vi.mocked(executeThemePush).mockResolvedValue(undefined)
    const command = new Push([], new Config({root: '.'}))
    await withCapturedStandardStreams(async ({stdout}) => {
      await command.command({json: true} as never, session, false)

      expect(JSON.parse(stdout())).toEqual({status: 'cancelled'})
    })
  })

  test('propagates strict failures without pushing or writing a result', async () => {
    const failure = new AbortError('Theme check failed. Please fix the errors before pushing.')
    vi.mocked(checkThemeBeforePush).mockRejectedValueOnce(failure)
    const command = new Push([], new Config({root: '.'}))
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(command.command({json: true, strict: true} as never, session, false)).rejects.toBe(failure)

      expect(executeThemePush).not.toHaveBeenCalled()
      expect(stdout()).toBe('')
    })
  })
})

const pushResult = {
  theme: {
    id: 1,
    name: 'Theme',
    role: 'unpublished',
    shop: session.storeFqdn,
    editor_url: 'https://test.myshopify.com/admin/themes/1/editor',
    preview_url: 'https://test.myshopify.com?preview_theme_id=1',
  },
  published: false,
  hasErrors: false,
  errors: {},
}

describeJsonCommand({
  command: Push,
  commandId: 'theme:push',
  moduleURL: new URL('../../../../../cli/src/index.ts', import.meta.url).href,
  args: ['--store', session.storeFqdn, '--password', 'token', '--theme', '1'],
  expectedResult: {
    status: 'success',
    changed: true,
    theme: {
      id: '1',
      name: 'Theme',
      role: 'unpublished',
      storeDomain: session.storeFqdn,
      previewUrl: 'https://test.myshopify.com?preview_theme_id=1',
      editorUrl: 'https://test.myshopify.com/admin/themes/1/editor',
    },
    issues: [],
  },
  expectedSchema: themeResultJsonSchema,
  setup: () => {
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(session)
    vi.mocked(executeThemePush).mockResolvedValue(pushResult)
  },
  assertExecuted: (format) => {
    expect(ensureAuthenticatedThemes).toHaveBeenCalledExactlyOnceWith(session.storeFqdn, 'token')
    expect(checkThemeBeforePush).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({theme: '1'}))
    expect(executeThemePush).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({store: session.storeFqdn, password: 'token', theme: '1', json: format === 'json'}),
      session,
      false,
      undefined,
    )
  },
  assertNotExecuted: () => {
    expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
    expect(checkThemeBeforePush).not.toHaveBeenCalled()
    expect(executeThemePush).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain("The theme 'Theme' (#1) was pushed successfully.")
  },
  diagnostics: {
    setup: () => {
      vi.mocked(executeThemePush).mockImplementation(async () => {
        outputInfo('Uploading theme files')
        return pushResult
      })
    },
    expectedEvents: [{type: 'diagnostic', level: 'info', message: 'Uploading theme files'}],
  },
  failure: {
    setup: () => {
      vi.mocked(executeThemePush).mockRejectedValue(new AbortError('Upload failed.'))
    },
    expectedError: {error: {type: 'abort', message: 'Upload failed.'}},
    exitCode: 1,
  },
})

import Push from './push.js'
import {executeThemePush} from '../../services/push.js'
import {checkThemeBeforePush} from '../../services/push/result.js'
import {themePushJsonOutputSchema} from '../../services/push/types.js'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test, vi} from 'vitest'
import {Config} from '@oclif/core'
import {AbortError} from '@shopify/cli-kit/node/error'

vi.mock('../../services/push.js')
vi.mock('../../services/push/result.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/push/result.js')>()),
  checkThemeBeforePush: vi.fn(),
}))

const session = {storeFqdn: 'test.myshopify.com', token: 'token'}

describe('theme push JSON', () => {
  test('exposes the schema in help and retains JSON and inherited flags', () => {
    expect(Push.jsonOutputSchema).toBe(themePushJsonOutputSchema)
    expect(Push.description).toContain('ThemePushJsonResult')
    expect(Push.flags.json).toBeDefined()
    expect(Push.baseFlags).toHaveProperty('json-schema')
  })

  test('executes and writes the result through the real encoder', async () => {
    vi.mocked(executeThemePush).mockResolvedValue({
      theme: {
        id: 1,
        name: 'Theme',
        role: 'unpublished',
        shop: session.storeFqdn,
        editor_url: 'editor',
        preview_url: 'preview',
      },
      published: false,
      hasErrors: false,
      errors: {},
    })
    const command = new Push([], new Config({root: '.'}))
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await command.command({json: true} as never, session, false)

      expect(JSON.parse(stdout())).toEqual({
        theme: {
          id: 1,
          name: 'Theme',
          role: 'unpublished',
          shop: session.storeFqdn,
          editor_url: 'editor',
          preview_url: 'preview',
        },
      })
      expect(stderr()).toBe('')
    })
  })

  test('retains cancellation without emitting a success result', async () => {
    vi.mocked(executeThemePush).mockResolvedValue(undefined)
    const command = new Push([], new Config({root: '.'}))
    await withCapturedStandardStreams(async ({stdout}) => {
      await command.command({json: true} as never, session, false)

      expect(stdout()).toBe('')
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

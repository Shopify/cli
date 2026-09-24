import Share from './share.js'
import {executeThemePush} from '../../services/push.js'
import {themeShareJsonOutputSchema} from '../../services/share/types.js'
import {Config} from '@oclif/core'
import {getRandomName} from '@shopify/cli-kit/common/string'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../services/push.js')
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
      editor_url: 'editor',
      preview_url: 'preview',
    },
    published: false,
    hasErrors: false,
    errors: {},
  }
}

describe('theme share', () => {
  test('exposes JSON and schema flags and documents its own result', () => {
    expect(Share.jsonOutputSchema).toBe(themeShareJsonOutputSchema)
    expect(Share.description).toContain('ThemeShareResult')
    expect(Share.flags.json).toBeDefined()
    expect(Share.baseFlags).toHaveProperty('json-schema')
  })

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
      expect(stdout()).toBe(`${themeShareJsonOutputSchema.encode({theme: result().theme})}\n`)
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

      expect(JSON.parse(stdout())).toEqual({
        environment: 'staging',
        theme: {
          ...result().theme,
          warning: "[staging] The theme 'Creative Theme' was pushed with errors",
          errors: {'assets/theme.css': ['bad CSS']},
        },
      })
    })
  })

  test('preserves the push success banner in text mode', async () => {
    vi.mocked(executeThemePush).mockResolvedValue(result())
    const output = mockAndCaptureOutput()
    output.clear()
    await new Share([], new Config({root: '.'})).command({} as never, session, false)
    expect(output.info()).toContain("The theme 'Creative Theme' (#1) was pushed successfully.")
    expect(output.info()).toContain('View your theme')
    expect(output.info()).toContain('Customize your theme at the theme editor')
  })

  test('does not emit a result when cancelled', async () => {
    vi.mocked(executeThemePush).mockResolvedValue(undefined)
    await withCapturedStandardStreams(async ({stdout}) => {
      await new Share([], new Config({root: '.'})).command({json: true} as never, session, false)

      expect(stdout()).toBe('')
    })
  })

  test('propagates theme creation failures through the shared error path', async () => {
    const failure = new Error('theme creation failed')
    vi.mocked(executeThemePush).mockRejectedValue(failure)
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(new Share([], new Config({root: '.'})).command({json: true} as never, session, false)).rejects.toBe(
        failure,
      )

      expect(stdout()).toBe('')
    })
  })

  test.each([{id: '1'}, {role: null}, {errors: {file: 'invalid'}}])('rejects malformed theme data %j', (fields) => {
    expect(() => themeShareJsonOutputSchema.validate({theme: {...result().theme, ...fields}})).toThrow()
  })
})

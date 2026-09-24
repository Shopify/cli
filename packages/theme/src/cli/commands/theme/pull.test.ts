import Pull from './pull.js'
import {executeThemePull} from '../../services/pull.js'
import {themePullJsonOutputSchema} from '../../services/pull/types.js'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test, vi} from 'vitest'
import {Config} from '@oclif/core'
import {AbortError} from '@shopify/cli-kit/node/error'

vi.mock('../../services/pull.js')
const session = {storeFqdn: 'test.myshopify.com', token: 'token'}

describe('theme pull JSON', () => {
  test('exposes the schema in help and retains JSON and inherited flags', () => {
    expect(Pull.jsonOutputSchema).toBe(themePullJsonOutputSchema)
    expect(Pull.description).toContain('ThemePullResult')
    expect(Pull.flags.json).toBeDefined()
    expect(Pull.baseFlags).toHaveProperty('json-schema')
  })

  test('executes and writes the result through the real encoder', async () => {
    vi.mocked(executeThemePull).mockResolvedValue({
      theme: {
        id: 1,
        name: 'Theme',
        role: 'unpublished',
        processing: false,
        shop: session.storeFqdn,
        editor_url: 'editor',
        preview_url: 'preview',
      },
      path: '/theme',
    })
    const command = new Pull([], new Config({root: '.'}))
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await command.command({json: true} as never, session, false)

      expect(JSON.parse(stdout())).toEqual({
        path: '/theme',
        theme: {
          id: 1,
          name: 'Theme',
          role: 'unpublished',
          processing: false,
          shop: session.storeFqdn,
          editor_url: 'editor',
          preview_url: 'preview',
        },
      })
      expect(stderr()).toBe('')
    })
  })

  test('retains cancellation without emitting a success result', async () => {
    vi.mocked(executeThemePull).mockResolvedValue(undefined)
    const command = new Pull([], new Config({root: '.'}))
    await withCapturedStandardStreams(async ({stdout}) => {
      await command.command({json: true} as never, session, false)

      expect(stdout()).toBe('')
    })
  })

  test('propagates download failures without writing a result', async () => {
    const failure = new AbortError('download failed')
    vi.mocked(executeThemePull).mockRejectedValueOnce(failure)
    const command = new Pull([], new Config({root: '.'}))
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(command.command({json: true} as never, session, false)).rejects.toBe(failure)

      expect(stdout()).toBe('')
    })
  })
})

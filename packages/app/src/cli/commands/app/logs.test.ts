import Logs from './logs.js'
import {Config} from '@oclif/core'
import {reportAnalyticsEvent} from '@shopify/cli-kit/node/analytics'
import {unstyled} from '@shopify/cli-kit/node/output'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {fileURLToPath} from 'node:url'

vi.mock('@shopify/cli-kit/node/analytics')

const removalMessage =
  '`shopify app logs` and `shopify app logs sources` were removed in Shopify CLI 5.0. ' +
  'To see Function logs, run `shopify app dev`.'

const originalExitCode = process.exitCode
afterEach(() => {
  process.exitCode = originalExitCode
  vi.unstubAllEnvs()
})

describe('removed app logs command', () => {
  test.each(
    [
      [],
      ['--store', 'example.myshopify.com', '--status', 'failure'],
      ['-s', 'first.myshopify.com', '-s', 'second.myshopify.com', '--source', 'extensions.discount'],
      ['--path', '/missing/app', '--config', 'missing', '--client-id', 'missing', '--reset'],
      ['sources'],
      ['sources', '--path', '/missing/app'],
    ].map((argv) => ({argv})),
  )('returns migration guidance without loading an app for $argv', async ({argv}) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runLogs(argv)
      expect(stdout()).toBe('')
      expect(
        unstyled(stderr())
          .replace(/[│╭╮╰╯─]/g, ' ')
          .replace(/\s+/g, ' '),
      ).toContain(removalMessage)
      expect(reportAnalyticsEvent).toHaveBeenCalledWith(expect.objectContaining({exitMode: 'expected_error'}))
    })
  })

  test.each([[], ['sources'], ['--store', 'example.myshopify.com', '--status', 'failure']].map((argv) => ({argv})))(
    'writes one JSON error document for $argv',
    async ({argv}) => {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await runLogs([...argv, '--json'])
        expect(JSON.parse(stdout())).toMatchObject({error: {type: 'abort', message: removalMessage}})
        expect(stderr()).toBe('')
      })
    },
  )

  test('honors JSON output selected through the environment', async () => {
    vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runLogs([])
      expect(JSON.parse(stdout())).toMatchObject({error: {type: 'abort', message: removalMessage}})
      expect(stderr()).toBe('')
    })
  })
})

async function runLogs(argv: string[]) {
  const config = await Config.load({root: fileURLToPath(new URL('../../../../', import.meta.url))})
  config.plugins.delete('@shopify/app')
  const exit = vi.spyOn(process, 'exit').mockReturnValue(undefined as never)
  try {
    await Logs.run(argv, config)
    expect(exit).toHaveBeenCalledExactlyOnceWith(1)
  } finally {
    exit.mockRestore()
  }
}

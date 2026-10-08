import Push from './push.js'

import {executeThemePush} from '../../services/push.js'

import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'
import {loadEnvironment} from '@shopify/cli-kit/node/environments'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {runWithCommandEvents, renderCommandEventAsJson} from '@shopify/cli-kit/node/command-events'
import {Config} from '@oclif/core'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../services/push.js')

vi.mock('@shopify/cli-kit/node/environments')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/metadata')

class TestPush extends Push {
  public parse = vi.fn()
}

describe.each([TestPush])('%s', (Command) => {
  test.each(['none', 'partial', 'total', 'cancelled', 'analytics'] as const)(
    'retains all environments in request order with %s failures',
    async (failures) => {
      await inTemporaryDirectory(async (path) => {
        vi.mocked(loadEnvironment).mockImplementation(async (name) => ({
          store: name === 'second' ? 'second.myshopify.com' : 'first.myshopify.com',
          password: 'password',
          path,
          theme: '1',
        }))
        vi.mocked(ensureAuthenticatedThemes).mockImplementation(async (store) => ({storeFqdn: store, token: 'token'}))
        let releaseFirst: () => void = () => {}
        const secondStarted = new Promise<void>((resolve) => {
          releaseFirst = resolve
        })
        vi.mocked(addPublicMetadata).mockImplementation(async (collect) => {
          const metadata = await collect()
          if (failures === 'analytics' && metadata?.store_domain === 'second.myshopify.com')
            throw new Error('analytics failed')
        })
        const executionOrder: string[] = []
        const execute = async (flags: {environment?: string[]}, session?: {storeFqdn: string}) => {
          const environment = flags.environment![0]!
          if (environment === 'first') await secondStarted
          if (environment === 'second') releaseFirst()
          executionOrder.push(environment)
          if (failures === 'cancelled' && environment === 'second') return undefined
          if (failures === 'total' || (failures === 'partial' && environment === 'second'))
            throw new Error('upload failed')
          return {
            environment,
            theme: {
              id: 1,
              name: environment,
              role: 'unpublished',
              processing: false,
              shop: session!.storeFqdn,
              editor_url: `https://${session!.storeFqdn}/admin/themes/1/editor`,
              preview_url: `https://${session!.storeFqdn}?preview_theme_id=1`,
            },
            path,
            published: false,
            hasErrors: false,
            errors: {},
          }
        }
        vi.mocked(executeThemePush).mockImplementation(execute)

        const command = new Command(
          ['--environment', 'first', '--environment', 'second', '--environment', 'third'],
          new Config({root: path}),
        )
        vi.spyOn(command, 'parse').mockResolvedValue({
          flags: {json: true, force: true, environment: ['first', 'second', 'third']},
          args: {},
        } as never)
        const previousExitCode = process.exitCode
        process.exitCode = 0
        try {
          await withCapturedStandardStreams(async ({stdout, stderr}) => {
            await runWithCommandEvents({outputMode: 'json', sink: renderCommandEventAsJson}, () => command.run())
            const {environments} = JSON.parse(stdout())
            expect(environments.map((entry: {environment: string}) => entry.environment)).toEqual([
              'first',
              'second',
              'third',
            ])
            if (failures === 'total') expect(environments.every((entry: {error?: unknown}) => entry.error)).toBe(true)
            else {
              expect(environments[0]).toMatchObject({result: {theme: {id: '1', storeDomain: 'first.myshopify.com'}}})
              expect(environments[2]).toHaveProperty('result')
              if (failures === 'partial') expect(environments[1]).toHaveProperty('error.message', 'upload failed')
              else if (failures === 'cancelled')
                expect(environments[1]).toMatchObject({result: {status: 'skipped', reason: 'unsafe-directory'}})
              else expect(environments[1]).toHaveProperty('result')
            }
            expect(executionOrder).toEqual(['second', 'first', 'third'])
            expect(process.exitCode).toBe(failures === 'total' || failures === 'partial' ? 1 : 0)
            const events = stderr().trim()
              ? stderr()
                  .trim()
                  .split('\n')
                  .filter(Boolean)
                  .map((line) => JSON.parse(line))
              : []
            expect(events.filter((event) => event.level === 'error')).toHaveLength(
              {none: 0, partial: 1, total: 3, cancelled: 0, analytics: 0}[failures],
            )
          })
        } finally {
          // eslint-disable-next-line require-atomic-updates
          process.exitCode = previousExitCode
        }
      })
    },
  )

  test('retains validation errors when every environment is invalid', async () => {
    vi.mocked(loadEnvironment).mockResolvedValue({})
    const command = new Command(['--environment', 'first', '--environment', 'second'], new Config({root: '.'}))
    vi.spyOn(command, 'parse').mockResolvedValue({
      flags: {json: true, force: true, environment: ['first', 'second']},
      args: {},
    } as never)
    const previousExitCode = process.exitCode
    process.exitCode = 0
    try {
      await withCapturedStandardStreams(async ({stdout}) => {
        await runWithCommandEvents({outputMode: 'json', sink: renderCommandEventAsJson}, () => command.run())
        expect(JSON.parse(stdout()).environments).toEqual([
          {
            environment: 'first',
            error: expect.objectContaining({type: 'abort', message: expect.stringContaining('Missing flags')}),
          },
          {
            environment: 'second',
            error: expect.objectContaining({type: 'abort', message: expect.stringContaining('Missing flags')}),
          },
        ])
        expect(executeThemePush).not.toHaveBeenCalled()

        expect(process.exitCode).toBe(1)
      })
    } finally {
      // eslint-disable-next-line require-atomic-updates
      process.exitCode = previousExitCode
    }
  })
})

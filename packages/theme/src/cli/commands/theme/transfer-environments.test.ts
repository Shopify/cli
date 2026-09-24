import Push from './push.js'
import Pull from './pull.js'
import {executeThemePull} from '../../services/pull.js'
import {executeThemePush} from '../../services/push.js'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {loadEnvironment} from '@shopify/cli-kit/node/environments'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {runWithCommandEvents, renderCommandEventAsJson} from '@shopify/cli-kit/node/command-events'
import {Config} from '@oclif/core'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../services/push.js')
vi.mock('../../services/pull.js')
vi.mock('@shopify/cli-kit/node/environments')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/metadata')

class TestPush extends Push {
  public parse = vi.fn()
}

class TestPull extends Pull {
  public parse = vi.fn()
}

describe.each([TestPush, TestPull])('%s', (Command) => {
  // Exercise real environment orchestration, presenter, encoder and streams.
  test.each(['none', 'partial', 'total'] as const)(
    'collects environment successes in requested order with %s failures',
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
        const executionOrder: string[] = []
        const execute = async (flags: {environment?: string[]}, session?: {storeFqdn: string}) => {
          const environment = flags.environment![0]!
          if (environment === 'first') await secondStarted
          if (environment === 'second') releaseFirst()
          executionOrder.push(environment)
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
              editor_url: 'editor',
              preview_url: 'preview',
            },
            path,
            published: false,
            hasErrors: false,
            errors: {},
          }
        }
        vi.mocked(executeThemePush).mockImplementation(execute)
        vi.mocked(executeThemePull).mockImplementation(execute)
        const command = new Command([], new Config({root: path}))
        const flags = {json: true, force: true, environment: ['first', 'second', 'third']}
        vi.spyOn(command, 'parse').mockResolvedValue({flags, args: {}} as never)
        const exitCode = process.exitCode
        await withCapturedStandardStreams(async ({stdout, stderr}) => {
          await runWithCommandEvents({outputMode: 'json', sink: renderCommandEventAsJson}, () => command.run())

          const results = JSON.parse(stdout())
          expect(results.map((result: {environment: string}) => result.environment)).toEqual(
            failures === 'total' ? [] : ['first', ...(failures === 'none' ? ['second'] : []), 'third'],
          )
          expect(executionOrder).toEqual(['second', 'first', 'third'])
          expect(process.exitCode).toBe(exitCode)
          const events = stderr().trim()
            ? stderr()
                .trim()
                .split('\n')
                .filter(Boolean)
                .map((line) => JSON.parse(line))
            : []
          expect(events.filter((event) => event.level === 'error')).toHaveLength(
            {none: 0, partial: 1, total: 3}[failures],
          )
        })
      })
    },
  )

  test('returns an empty array when every environment is invalid', async () => {
    vi.mocked(loadEnvironment).mockResolvedValue({})
    const command = new Command([], new Config({root: '.'}))
    vi.spyOn(command, 'parse').mockResolvedValue({
      flags: {json: true, force: true, environment: ['first', 'second']},
      args: {},
    } as never)
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runWithCommandEvents({outputMode: 'json', sink: renderCommandEventAsJson}, () => command.run())

      expect(JSON.parse(stdout())).toEqual([])
      expect(executeThemePush).not.toHaveBeenCalled()
      expect(
        stderr()
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line)),
      ).toEqual([
        expect.objectContaining({type: 'diagnostic', level: 'warning'}),
        expect.objectContaining({type: 'diagnostic', level: 'warning'}),
      ])
    })
  })
})

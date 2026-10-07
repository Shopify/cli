import Deploy from './deploy.js'
import {deploy} from '../../services/deploy.js'
import {linkedAppContext} from '../../services/app-context.js'
import {testAppLinked, testOrganizationApp, testProject} from '../../models/app/app.test-data.js'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {errorHandler} from '@shopify/cli-kit/node/error-handler'
import {Config, Errors} from '@oclif/core'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {fileURLToPath} from 'node:url'
import type {DeployResult} from '../../services/deploy/types.js'

vi.mock('../../services/deploy.js')
vi.mock('../../services/app-context.js')

const originalExitCode = process.exitCode
afterEach(() => {
  process.exitCode = originalExitCode
  vi.unstubAllEnvs()
})

describe('app deploy command', () => {
  beforeEach(() => {
    process.exitCode = undefined
    vi.mocked(linkedAppContext).mockReset()
    const app = testAppLinked()
    vi.mocked(linkedAppContext).mockResolvedValue({
      app,
      project: testProject(),
      remoteApp: testOrganizationApp(),
    } as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(deploy).mockResolvedValue(completedDeployResult(app))
  })

  test('accepts --config together with --client-id to deploy a configuration to a different app', async () => {
    await inTemporaryDirectory(async (tmp) => {
      await Deploy.run(
        ['--path', tmp, '--config', 'prod', '--client-id', 'a-different-app', '--allow-updates'],
        import.meta.url,
      )

      expect(linkedAppContext).toHaveBeenCalledWith({
        directory: tmp,
        clientId: 'a-different-app',
        forceRelink: false,
        userProvidedConfigName: 'prod',
      })
    })
  })

  test('still rejects --reset together with --config', async () => {
    await inTemporaryDirectory(async (tmp) => {
      await expect(
        Deploy.run(['--path', tmp, '--config', 'prod', '--reset', '--allow-updates'], import.meta.url),
      ).rejects.toThrow()

      expect(linkedAppContext).not.toHaveBeenCalled()
    })
  })

  test('writes one JSON result and sends diagnostics to stderr', async () => {
    vi.mocked(deploy).mockImplementationOnce(async () => {
      outputInfo('Releasing an app version')
      return completedDeployResult(testAppLinked())
    })
    await inTemporaryDirectory(async (directory) => {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await runDeploy(['--path', directory, '--json', '--allow-updates'])
        expect(JSON.parse(stdout())).toEqual({
          status: 'success',
          app: {name: 'app1', clientId: 'api-key'},
          deployment: {
            released: true,
            version: {
              gid: 'gid://shopify/Version/1',
              name: 'v1',
              message: null,
              url: 'https://dev.shopify.com/dashboard/1/apps/1/versions/1',
            },
          },
        })
        expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', message: 'Releasing an app version'})
      })
    })
  })

  test('a silent build failure uses the fatal error path instead of cancelled', async () => {
    vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
    vi.mocked(deploy).mockRejectedValue(new AbortSilentError())
    await inTemporaryDirectory(async (tmp) => {
      await withCapturedStandardStreams(async ({stdout}) => {
        await expect(runDeploy(['--path', tmp, '--json', '--allow-updates'])).rejects.toThrow()
        expect(JSON.parse(stdout())).toMatchObject({
          error: {
            type: 'abort',
            message: 'The app deployment did not complete. See the deployment diagnostics for details.',
          },
        })
      })
    })
  })

  test('cancelled JSON exits zero without running success hooks', async () => {
    class CancelledDeploy extends Deploy {
      async catch(error: Error): Promise<never> {
        await errorHandler(error)
        await Errors.handle(error)
        throw error
      }

      protected async init(): Promise<void> {}
    }
    vi.mocked(deploy).mockResolvedValue({status: 'cancelled', app: testAppLinked()})
    const config = await Config.load({root: joinPath(dirname(fileURLToPath(import.meta.url)), '../../../..')})
    const runHook = vi.spyOn(config, 'runHook').mockResolvedValue({successes: [], failures: []})
    const exit = vi.spyOn(process, 'exit').mockReturnValue(undefined as never)
    try {
      await inTemporaryDirectory(async (directory) => {
        await withCapturedStandardStreams(async ({stdout, stderr}) => {
          await expect(
            config.runCommand('app:deploy', ['--path', directory, '--json', '--allow-updates'], {
              id: 'app:deploy',
              aliases: [],
              hiddenAliases: [],
              hidden: false,
              args: {},
              flags: {},
              load: async () => CancelledDeploy,
            }),
          ).rejects.toBeInstanceOf(AbortSilentError)
          expect(exit).toHaveBeenCalledExactlyOnceWith(0)
          expect(runHook).not.toHaveBeenCalledWith('postrun', expect.anything())
          expect(JSON.parse(stdout())).toEqual({status: 'cancelled'})
          expect(stderr()).toBe('')
        })
      })
    } finally {
      runHook.mockRestore()
      exit.mockRestore()
    }
  })
})

async function runDeploy(argv: string[]) {
  const config = await Config.load({root: joinPath(dirname(fileURLToPath(import.meta.url)), '../../../..')})
  // The source package is bundled in the installed CLI, not a custom plugin.
  config.plugins.delete('@shopify/app')
  return Deploy.run(argv, config)
}

function completedDeployResult(app: ReturnType<typeof testAppLinked>): Exclude<DeployResult, {status: 'cancelled'}> {
  return {
    status: 'success',
    app,
    release: true,
    didMigrateExtensionsToDevDash: false,
    uploadExtensionsBundleResult: {
      validationErrors: [],
      versionGid: 'gid://shopify/Version/1',
      versionTag: 'v1',
      location: 'https://dev.shopify.com/dashboard/1/apps/1/versions/1',
    },
  }
}

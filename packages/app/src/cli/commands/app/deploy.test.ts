import Deploy from './deploy.js'
import {deploy} from '../../services/deploy.js'
import {linkedAppContext} from '../../services/app-context.js'
import {testAppLinked, testOrganizationApp, testProject} from '../../models/app/app.test-data.js'
import {appDeployJsonOutputSchema} from '../../services/deploy/types.js'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {AbortError, AbortSilentError} from '@shopify/cli-kit/node/error'
import * as system from '@shopify/cli-kit/node/system'
import {Config} from '@oclif/core'
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

  test('exposes the result schema in help', () => {
    expect(Deploy.jsonOutputSchema).toBe(appDeployJsonOutputSchema)
    expect(Deploy.description).toContain('AppDeployResult')
    expect(Deploy.flags.json.char).toBe('j')
  })

  test('writes one JSON result and sends diagnostics to stderr', async () => {
    vi.mocked(deploy).mockImplementationOnce(async () => {
      outputInfo('Releasing an app version')
      return {
        status: 'success',
        app: testAppLinked(),
        release: true,
        didMigrateExtensionsToDevDash: false,
        uploadExtensionsBundleResult: {
          validationErrors: [],
          versionGid: 'gid://shopify/Version/1',
          versionTag: 'v1',
          message: 'Release message',
          location: 'https://dev.shopify.com/dashboard/1/apps/1/versions/1',
        },
      }
    })
    await inTemporaryDirectory(async (tmp) => {
      await withCapturedStandardStreams(async (streams) => {
        await runDeploy(['--path', tmp, '--json', '--no-input', '--allow-updates'])
        expect(JSON.parse(streams.stdout())).toEqual({
          status: 'success',
          app: {name: 'app1', clientId: 'api-key'},
          deployment: {
            released: true,
            version: {
              gid: 'gid://shopify/Version/1',
              name: 'v1',
              message: 'Release message',
              url: 'https://dev.shopify.com/dashboard/1/apps/1/versions/1',
            },
          },
        })
        expect(JSON.parse(streams.stderr())).toMatchObject({type: 'diagnostic', message: 'Releasing an app version'})
      })
    })
  })

  test('returns the created version without release when --no-release is used', async () => {
    vi.mocked(deploy).mockResolvedValue(completedDeployResult(testAppLinked(), false))
    await inTemporaryDirectory(async (tmp) => {
      await withCapturedStandardStreams(async (streams) => {
        await Deploy.run(['--path', tmp, '--json', '--no-release', '--no-input'], import.meta.url)
        expect(JSON.parse(streams.stdout())).toMatchObject({status: 'success', deployment: {released: false}})
        expect(deploy).toHaveBeenCalledWith(
          expect.objectContaining({noRelease: true, allowUpdates: true, allowDeletes: true}),
        )
      })
    })
  })

  test('returns cancelled after a declined confirmation', async () => {
    vi.mocked(deploy).mockResolvedValue({status: 'cancelled', app: testAppLinked()})
    await inTemporaryDirectory(async (tmp) => {
      await withCapturedStandardStreams(async (streams) => {
        await Deploy.run(['--path', tmp, '--json', '--allow-updates'], import.meta.url)
        expect(JSON.parse(streams.stdout())).toEqual({status: 'cancelled'})
        expect(process.exitCode).toBeUndefined()
      })
    })
  })

  test('does not catch cancellation in text mode', async () => {
    vi.mocked(deploy).mockResolvedValue({status: 'cancelled', app: testAppLinked()})
    await inTemporaryDirectory(async (tmp) => {
      await withCapturedStandardStreams(async (streams) => {
        await expect(Deploy.run(['--path', tmp, '--allow-updates'], import.meta.url)).rejects.toThrow()
        expect(streams.stdout()).toBe('')
      })
    })
  })

  test('preserves the fatal error path without a success result', async () => {
    vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
    vi.mocked(deploy).mockRejectedValue(new AbortError('Version could not be created.'))
    await inTemporaryDirectory(async (tmp) => {
      await withCapturedStandardStreams(async (streams) => {
        await expect(Deploy.run(['--path', tmp, '--json', '--allow-updates'], import.meta.url)).rejects.toThrow()
        expect(JSON.parse(streams.stdout())).toMatchObject({
          error: {type: 'abort', message: 'Version could not be created.'},
        })
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

  test('JSON does not disable confirmation policy', async () => {
    vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
    vi.spyOn(system, 'terminalSupportsPrompting').mockReturnValue(false)
    await inTemporaryDirectory(async (tmp) => {
      await withCapturedStandardStreams(async (streams) => {
        await expect(Deploy.run(['--path', tmp, '--json'], import.meta.url)).rejects.toThrow()
        expect(JSON.parse(streams.stdout())).toMatchObject({error: {type: 'abort'}})
        expect(deploy).not.toHaveBeenCalled()
      })
    })
    vi.mocked(system.terminalSupportsPrompting).mockRestore()
  })

  test('JSON remains interactive when input is available', async () => {
    vi.spyOn(system, 'terminalSupportsPrompting').mockReturnValue(true)
    try {
      await inTemporaryDirectory(async (tmp) => {
        await withCapturedStandardStreams(async ({stdout}) => {
          await runDeploy(['--path', tmp, '--json'])
          expect(JSON.parse(stdout())).toMatchObject({status: 'success'})
          expect(deploy).toHaveBeenCalledWith(
            expect.objectContaining({allowUpdates: undefined, allowDeletes: undefined}),
          )
        })
      })
    } finally {
      vi.mocked(system.terminalSupportsPrompting).mockRestore()
    }
  })

  test('no-input alone keeps text presentation', async () => {
    await inTemporaryDirectory(async (tmp) => {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await runDeploy(['--path', tmp, '--no-input', '--allow-updates'])
        expect(stdout()).toBe('')
        expect(stderr()).toContain('New version released to users.')
      })
    })
  })

  test('still rejects the unsupported environment flag', async () => {
    await inTemporaryDirectory(async (tmp) => {
      await expect(
        Deploy.run(['--path', tmp, '--environment', 'production', '--allow-updates'], import.meta.url),
      ).rejects.toThrow()
      expect(deploy).not.toHaveBeenCalled()
    })
  })
})

async function runDeploy(argv: string[]) {
  const config = await Config.load({root: joinPath(dirname(fileURLToPath(import.meta.url)), '../../../..')})
  // The source package is bundled in the installed CLI, not a custom plugin.
  config.plugins.delete('@shopify/app')
  return Deploy.run(argv, config)
}

function completedDeployResult(
  app: ReturnType<typeof testAppLinked>,
  release = true,
): Exclude<DeployResult, {status: 'cancelled'}> {
  return {
    status: 'success',
    app,
    release,
    didMigrateExtensionsToDevDash: false,
    uploadExtensionsBundleResult: {
      validationErrors: [],
      versionGid: 'gid://shopify/Version/1',
      versionTag: 'v1',
      location: 'https://dev.shopify.com/dashboard/1/apps/1/versions/1',
    },
  }
}

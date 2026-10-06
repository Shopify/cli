import Build from './build.js'
import build from '../../services/build.js'
import {localAppContext} from '../../services/app-context.js'
import {appBuildJsonOutputSchema} from '../../services/build/types.js'
import {testApp, testProject} from '../../models/app/app.test-data.js'
import {appFlags} from '../../flags.js'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {expect, test, vi} from 'vitest'
import {unstyled} from '@shopify/cli-kit/node/output'

vi.mock('../../services/build.js')
vi.mock('../../services/app-context.js')

function setup(directory: string) {
  const app = testApp({name: 'Example app', directory, webs: []})
  vi.mocked(localAppContext).mockResolvedValue({app, project: testProject(), activeConfig: {} as never})
  vi.mocked(build).mockResolvedValue({status: 'success', app: {name: app.name, directory}, webs: [], extensions: []})
  return app
}

test('declares JSON/schema/help and retains app and inherited flags', () => {
  expect(Build.flags.json).toBeDefined()
  expect(Build.flags.path).toBe(appFlags.path)
  expect(Build.baseFlags).toHaveProperty('json-schema')
  expect(Build.baseFlags['auth-alias']).toBeDefined()
  expect(Build.jsonOutputSchema).toBe(appBuildJsonOutputSchema)
  expect(Build.descriptionForHelp()).toContain('AppBuildResult')
})

test.each([{additionalFlags: []}, {additionalFlags: ['--no-input']}])(
  'JSON and no-input remain independent with $additionalFlags',
  async ({additionalFlags}) => {
    await inTemporaryDirectory(async (directory) => {
      setup(directory)
      await withCapturedStandardStreams(async ({stdout}) => {
        await Build.run(
          ['--path', directory, '--json', '--skip-dependencies-installation', ...additionalFlags],
          import.meta.url,
        )
        expect(JSON.parse(stdout())).toStrictEqual({
          status: 'success',
          app: {name: 'Example app', directory},
          webs: [],
          extensions: [],
        })
      })
      expect(build).toHaveBeenCalledWith(expect.objectContaining({skipDependenciesInstallation: true}))
    })
  },
)

test('no-input alone keeps the text result', async () => {
  await inTemporaryDirectory(async (directory) => {
    setup(directory)
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await Build.run(['--path', directory, '--no-input'], import.meta.url)
      expect(stdout()).toBe('')
      expect(unstyled(stderr())).toContain('Example app built!')
    })
  })
})

test('silent build failure becomes one fatal JSON document, not an empty stdout', async () => {
  await inTemporaryDirectory(async (directory) => {
    setup(directory)
    vi.mocked(build).mockRejectedValueOnce(new AbortSilentError())
    vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
    try {
      await withCapturedStandardStreams(async ({stdout}) => {
        await expect(Build.run(['--path', directory, '--json'], import.meta.url)).rejects.toThrow()
        expect(JSON.parse(stdout())).toMatchObject({
          error: {type: 'abort', message: 'The app build did not complete. See the build diagnostics for details.'},
        })
      })
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

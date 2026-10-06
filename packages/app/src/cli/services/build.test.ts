import build from './build.js'
import buildWeb from './web.js'
import {installAppDependencies} from './dependencies.js'
import {installJavy} from './function/build.js'
import {appBuildJsonOutputSchema} from './build/types.js'
import {presentAppBuildResult} from './build/presenter.js'
import {testApp, testProject, testUIExtension} from '../models/app/app.test-data.js'
import {WebType} from '../models/app/app.js'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {expect, test, vi} from 'vitest'
import {unstyled} from '@shopify/cli-kit/node/output'

vi.mock('./web.js')
vi.mock('./dependencies.js')
vi.mock('./function/build.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./function/build.js')>()),
  installJavy: vi.fn(),
}))

function buildResult() {
  return {status: 'success' as const, appName: 'Example app'}
}

test('build completes webs and the real presenter writes only the JSON success status', async () => {
  await inTemporaryDirectory(async (directory) => {
    const webDirectory = joinPath(directory, 'web')
    const app = testApp({
      name: 'Example app',
      directory,
      webs: [
        {
          directory: webDirectory,
          configuration: {roles: [WebType.Backend], commands: {dev: '', build: 'external-build'}},
        },
      ],
    })
    vi.mocked(buildWeb).mockImplementation(async (_command, {stdout, stderr}) => {
      stdout.write('web built\n')
      stderr.write('build diagnostic\n')
    })
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runWithCommandEventsForCommand(['--json'], async () => {
        const result = await build({app, project: testProject(), skipDependenciesInstallation: true})
        expect(result).toStrictEqual(buildResult())
        presentAppBuildResult(result, true)
      })
      expect(JSON.parse(stdout())).toStrictEqual({status: 'success'})
      const diagnostics = stderr()
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
      expect(diagnostics.some((event) => event.type === 'diagnostic' && event.message.includes('web built'))).toBe(true)
      expect(
        diagnostics.some((event) => event.type === 'diagnostic' && event.message.includes('build diagnostic')),
      ).toBe(true)
      expect(stdout()).not.toContain('client_id')
      expect(stdout()).not.toContain('dotenv')
      expect(stdout()).not.toContain('built!')
    })
  })
})

test('empty apps report success and skip dependency installation when requested', async () => {
  await inTemporaryDirectory(async (directory) => {
    const app = testApp({name: 'Example app', directory, webs: []})
    vi.mocked(installAppDependencies).mockClear()
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runWithCommandEventsForCommand(['--json'], async () => {
        const result = await build({app, project: testProject(), skipDependenciesInstallation: true})
        presentAppBuildResult(result, true)
      })
      expect(JSON.parse(stdout())).toStrictEqual({status: 'success'})
      expect(stderr()).toBe('')
      expect(installAppDependencies).not.toHaveBeenCalled()
      expect(installJavy).toHaveBeenCalledWith(app)
    })
  })
})

test('build completes extensions and reports only the JSON success status', async () => {
  await inTemporaryDirectory(async (directory) => {
    const extension = await testUIExtension({directory: joinPath(directory, 'extension')})
    vi.spyOn(extension, 'build').mockImplementation(async ({stdout}) => {
      stdout.write('extension built\n')
    })
    const app = testApp({name: 'Example app', directory, webs: [], allExtensions: [extension]})
    await withCapturedStandardStreams(async ({stdout}) => {
      await runWithCommandEventsForCommand(['--json'], async () => {
        const result = await build({app, project: testProject(), skipDependenciesInstallation: true})
        presentAppBuildResult(result, true)
      })
      expect(JSON.parse(stdout())).toStrictEqual({status: 'success'})
      expect(extension.build).toHaveBeenCalledOnce()
      expect(stdout()).not.toContain('configuration')
      expect(stdout()).not.toContain('devUUID')
    })
  })
})

test.each([false, true])('dependency installation retains workspace policy: %s', async (usesWorkspaces) => {
  const app = testApp({webs: []})
  const project = testProject({usesWorkspaces})
  await build({app, project, skipDependenciesInstallation: false})
  expect(installAppDependencies).toHaveBeenCalledTimes(usesWorkspaces ? 0 : 1)
})

test('real text presenter preserves the build success message', async () => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runWithCommandEventsForCommand([], () => presentAppBuildResult(buildResult(), false))
    expect(unstyled(stderr())).toContain('Example app built!')
    expect(stdout()).toBe('')
  })
})

test('build failures retain the original error and do not print a successful result', async () => {
  await inTemporaryDirectory(async (directory) => {
    const app = testApp({
      directory,
      webs: [{directory, configuration: {roles: [WebType.Backend], commands: {dev: '', build: 'external-build'}}}],
    })
    const failure = new Error('external build failed')
    vi.mocked(buildWeb).mockRejectedValueOnce(failure)
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await expect(
        runWithCommandEventsForCommand(['--json'], async () => {
          const result = await build({app, project: testProject(), skipDependenciesInstallation: true})
          presentAppBuildResult(result, true)
        }),
      ).rejects.toBe(failure)
      expect(stdout()).toBe('')
      expect(stderr()).toContain('"status":"failed"')
    })
  })
})

test.each([
  ['missing status', {}],
  ['invalid status', {status: 'failed'}],
  ['extra field', {status: 'success', appName: 'Example app'}],
])('rejects %s', (_name, invalid) => {
  expect(() => appBuildJsonOutputSchema.validate(invalid)).toThrow()
})

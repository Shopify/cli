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

function emptyResult(directory: string) {
  return {status: 'success' as const, app: {name: 'Example app', directory}, webs: [], extensions: []}
}

test('build returns an explicit public projection and the real presenter writes one JSON result', async () => {
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
        presentAppBuildResult(result, true)
      })
      expect(JSON.parse(stdout())).toStrictEqual({
        ...emptyResult(directory),
        webs: [{directory: webDirectory, roles: ['backend']}],
      })
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

test('empty apps retain named empty collections and skip dependency installation when requested', async () => {
  await inTemporaryDirectory(async (directory) => {
    const app = testApp({name: 'Example app', directory, webs: []})
    vi.mocked(installAppDependencies).mockClear()
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runWithCommandEventsForCommand(['--json'], async () => {
        const result = await build({app, project: testProject(), skipDependenciesInstallation: true})
        presentAppBuildResult(result, true)
      })
      expect(JSON.parse(stdout())).toStrictEqual(emptyResult(directory))
      expect(stderr()).toBe('')
      expect(installAppDependencies).not.toHaveBeenCalled()
      expect(installJavy).toHaveBeenCalledWith(app)
    })
  })
})

test('build projects extensions without exposing their configuration or internal IDs', async () => {
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
      expect(JSON.parse(stdout())).toStrictEqual({
        ...emptyResult(directory),
        extensions: [{name: extension.name, type: extension.type, directory: extension.directory}],
      })
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
  await inTemporaryDirectory(async (directory) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runWithCommandEventsForCommand([], () => presentAppBuildResult(emptyResult(directory), false))
      expect(unstyled(stderr())).toContain('Example app built!')
      expect(stdout()).toBe('')
    })
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
  ['root field', (directory: string) => ({...emptyResult(directory), internal: true})],
  [
    'nested field',
    (directory: string) => ({...emptyResult(directory), app: {name: 'Example app', directory, secret: 'not-public'}}),
  ],
  [
    'relative directory',
    (directory: string) => ({...emptyResult(directory), app: {name: 'Example app', directory: 'relative'}}),
  ],
  ['invalid role', (directory: string) => ({...emptyResult(directory), webs: [{directory, roles: ['invalid']}]})],
  [
    'extension extra field',
    (directory: string) => ({
      ...emptyResult(directory),
      extensions: [{name: 'Extension', type: 'theme', directory, internal: true}],
    }),
  ],
])('rejects %s with all other required fields valid', async (_name, invalid) => {
  await inTemporaryDirectory(async (directory) => {
    expect(() => appBuildJsonOutputSchema.validate(invalid(directory))).toThrow()
  })
})

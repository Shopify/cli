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

vi.mock('./web.js')
vi.mock('./dependencies.js')
vi.mock('./function/build.js')

test('build returns data and the real presenter reserves stdout for the JSON result', async () => {
  await inTemporaryDirectory(async (directory) => {
    const extension = await testUIExtension({directory: joinPath(directory, 'extension')})
    vi.spyOn(extension, 'build').mockImplementation(async ({stdout}) => {
      stdout.write('extension built\n')
    })
    vi.mocked(buildWeb).mockImplementation(async (_command, {stdout, stderr}) => {
      stdout.write('web built\n')
      stderr.write('build diagnostic\n')
    })
    const app = testApp({
      name: 'Example app',
      directory,
      allExtensions: [extension],
      webs: [{directory, configuration: {roles: [WebType.Backend], commands: {dev: '', build: 'external-build'}}}],
    })
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runWithCommandEventsForCommand(['--json'], async () => {
        const result = await build({app, project: testProject(), skipDependenciesInstallation: true})
        expect(result).toStrictEqual({status: 'success', appName: 'Example app'})
        expect(stdout()).toBe('')
        presentAppBuildResult(result, true)
      })
      expect(JSON.parse(stdout())).toStrictEqual({status: 'success'})
      const messages = stderr()
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line).message)
      expect(messages).toEqual(
        expect.arrayContaining(
          ['web built', 'build diagnostic', 'extension built'].map((message) => expect.stringContaining(message)),
        ),
      )
      expect(extension.build).toHaveBeenCalledOnce()
      expect(installAppDependencies).not.toHaveBeenCalled()
    })
  })
})

test('empty apps still return a successful result', async () => {
  const app = testApp({name: 'Empty app', webs: [], allExtensions: []})
  await expect(build({app, project: testProject(), skipDependenciesInstallation: true})).resolves.toStrictEqual({
    status: 'success',
    appName: 'Empty app',
  })
  expect(installJavy).toHaveBeenCalledWith(app)
})

test.each([
  ['missing status', {}],
  ['invalid status', {status: 'failed'}],
  ['extra field', {status: 'success', appName: 'Example app'}],
])('rejects %s', (_name, invalid) => {
  expect(() => appBuildJsonOutputSchema.encode(invalid as never)).toThrow()
})

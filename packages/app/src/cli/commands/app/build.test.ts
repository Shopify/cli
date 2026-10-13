import Build from './build.js'
import build from '../../services/build.js'
import {localAppContext} from '../../services/app-context.js'
import {testApp, testProject} from '../../models/app/app.test-data.js'
import {appFlags} from '../../flags.js'
import {tempDirectory, rmdir} from '@shopify/cli-kit/node/fs'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {expect, test, vi} from 'vitest'

vi.mock('../../services/build.js')
vi.mock('../../services/app-context.js')

let directory: string

describeJsonCommand({
  command: Build,
  commandId: 'app:build',
  moduleURL: new URL('../../../../../cli/bin/dev.js', import.meta.url).href,
  args: () => ['--path', directory, '--skip-dependencies-installation'],
  expectedResult: {status: 'success'},
  expectedSchema: {type: 'object', required: ['status'], additionalProperties: false},
  setup: () => {
    directory = tempDirectory()
    const app = testApp({name: 'Example app', directory, webs: []})
    vi.mocked(localAppContext).mockResolvedValue({app, project: testProject(), activeConfig: {} as never})
    vi.mocked(build).mockResolvedValue({status: 'success', appName: app.name})
    const fixtureDirectory = directory
    return () => rmdir(fixtureDirectory)
  },
  assertExecuted: () => {
    expect(localAppContext).toHaveBeenCalledExactlyOnceWith({directory, userProvidedConfigName: undefined})
    expect(build).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({skipDependenciesInstallation: true}))
  },
  assertNotExecuted: () => {
    expect(localAppContext).not.toHaveBeenCalled()
    expect(build).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain('Example app built!')
  },
  failure: {
    setup: () => {
      vi.mocked(build).mockRejectedValue(new AbortSilentError())
    },
    expectedError: {
      error: {type: 'abort', message: 'The app build did not complete. See the build diagnostics for details.'},
    },
    exitCode: 1,
  },
})

test('retains app and inherited authentication flags', () => {
  expect(Build.flags.path).toBe(appFlags.path)
  expect(Build.baseFlags['auth-alias']).toBeDefined()
})

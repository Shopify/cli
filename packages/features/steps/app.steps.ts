import {strict as assert} from 'assert'

import {When, Then} from '@cucumber/cucumber'

import {executables} from '../lib/constants'
import {exec} from '../lib/system'

interface UIExtensionConfiguration {
  name: string
  extensionType: string
}

When(
  /I create an extension named (.+) of type (.+)/,
  {timeout: 2 * 60 * 1000},
  async function (extensionName: string, extensionType: string) {
    await exec(executables.cli, [
      'app',
      'scaffold',
      'extension',
      '--name',
      extensionName,
      '--path',
      this.appDirectory,
      '--type',
      extensionType,
    ])
  },
)

Then(
  /I have an extension named (.+) of type (.+)/,
  {},
  async function (appName: string, extensionType: string) {
    const {stdout} = await exec(executables.cli, [
      'app',
      'info',
      '--path',
      this.appDirectory,
    ])
    const results = JSON.parse(stdout)
    const extension = results.uiExtensions.find(
      (extension: {configuration: UIExtensionConfiguration}) => {
        return extension.configuration.name === appName
      },
    )
    if (!extension)
      assert.fail(
        `Extension not created! Config:\n${JSON.stringify(results, null, 2)}`,
      )
    assert.equal(extension.configuration.extensionType, extensionType)
  },
)

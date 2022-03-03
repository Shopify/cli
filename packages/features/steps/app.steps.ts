import {strict as assert} from 'assert'

import {When, Then} from '@cucumber/cucumber'

import {executables} from '../lib/constants'
import {exec} from '../lib/system'

interface UIExtensionConfiguration {
  name: string
  uiExtensionType: string
}

When(
  /I create a UI extension named (.+) of type (.+)/,
  {timeout: 2 * 60 * 1000},
  async function (uiExtensionName: string, uiExtensionType: string) {
    await exec(executables.cli, [
      'app',
      'scaffold',
      'ui-extension',
      '--name',
      uiExtensionName,
      '--path',
      this.appDirectory,
      '--type',
      uiExtensionType,
    ])
  },
)

Then(
  /I have a UI extension named (.+) of type (.+)/,
  {},
  async function (appName: string, uiExtensionType: string) {
    const {stdout} = await exec(executables.cli, [
      'app',
      'info',
      '--path',
      this.appDirectory,
    ])
    const results = JSON.parse(stdout)
    const uiExtension = results.uiExtensions.find(
      (uiExtension: {configuration: UIExtensionConfiguration}) => {
        return uiExtension.configuration.name === appName
      },
    )
    if (!uiExtension)
      assert.fail(
        `Extension not created! Config:\n${JSON.stringify(results, null, 2)}`,
      )
    assert.equal(uiExtension.configuration.uiExtensionType, uiExtensionType)
  },
)

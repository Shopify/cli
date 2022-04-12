import {executables} from '../lib/constants'
import {exec} from '../lib/system'
import {When, Then} from '@cucumber/cucumber'
import {strict as assert} from 'assert'

interface ExtensionConfiguration {
  name: string
  extensionType: string
}

When(
  /I create a extension named (.+) of type (.+)/,
  {timeout: 2 * 60 * 1000},
  async function (extensionName: string, extensionType: string) {
    await exec(
      executables.cli,
      ['app', 'scaffold', 'extension', '--name', extensionName, '--path', this.appDirectory, '--type', extensionType],
      {env: {...process.env, ...this.temporaryEnv}},
    )
  },
)

Then(/I have a extension named (.+) of type (.+)/, {}, async function (appName: string, extensionType: string) {
  const {stdout} = await exec(executables.cli, ['app', 'info', '--path', this.appDirectory], {
    env: {...process.env, ...this.temporaryEnv},
  })
  const results = JSON.parse(stdout)
  const extension = results.extensions.find((extension: {configuration: ExtensionConfiguration}) => {
    return extension.configuration.name === appName
  })
  if (!extension) assert.fail(`Extension not created! Config:\n${JSON.stringify(results, null, 2)}`)
  assert.equal(extension.configuration.type, extensionType)
})

import {executables} from '../lib/constants'
import {exec} from '../lib/system'
import {When, Then} from '@cucumber/cucumber'
import * as path from 'pathe'
import fs from 'fs-extra'
import {strict as assert} from 'assert'

interface ExtensionConfiguration {
  configuration: {
    name: string
  }
  outputBundlePath: string
}

When(
  /I create an app named (.+) with (.+) as package manager/,
  {timeout: 5 * 60 * 1000},
  async function (appName: string, packageManager: string) {
    const {stdout} = await exec(
      'node',
      [
        executables.createApp,
        '--name',
        appName,
        '--path',
        this.temporaryDirectory,
        '--package-manager',
        packageManager,
        '--local',
        '--template',
        'https://github.com/Shopify/shopify-app-template-node#richard/frontend-via-submodules-toml-updates',
      ],
      {env: {...process.env, ...this.temporaryEnv, FORCE_COLOR: '0'}},
    )
    const hyphenatedAppName = stdout.match(/([\w-]+) is ready for you to build!/)[1]
    this.appDirectory = path.join(this.temporaryDirectory, hyphenatedAppName)
  },
)

Then(
  /I have an app named (.+) generated from the template with (.+) as package manager/,
  {},
  async function (appName: string, packageManager: string) {
    const {stdout} = await exec(executables.cli, ['app', 'info', '--path', this.appDirectory, '--json'], {
      env: {...process.env, ...this.temporaryEnv},
    })
    const results = JSON.parse(stdout)
    assert.equal(results.packageManager, packageManager)
  },
)

Then(/I build the app/, {timeout: 2 * 60 * 1000 * 1000}, async function () {
  await exec('node', [executables.cli, 'app', 'build', '--path', this.appDirectory], {
    env: {...process.env, ...this.temporaryEnv},
  })
})

Then(/The UI extensions are built/, {timeout: 2 * 60 * 1000 * 1000}, async function () {
  const appInfo = await this.appInfo()
  const extensionsMissingBuildFile = appInfo.extensions.ui.filter((extension: ExtensionConfiguration) => {
    const buildFilePath = extension.outputBundlePath

    return !fs.pathExistsSync(buildFilePath)
  })

  if (extensionsMissingBuildFile.length) {
    const extensionNames = extensionsMissingBuildFile.map(
      (extensions: ExtensionConfiguration) => extensions.configuration.name,
    )
    assert.fail(`Extensions without built file:\n${extensionNames.join(', ')}`)
  }
})

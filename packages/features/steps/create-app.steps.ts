import {executables} from '../lib/constants.js'
import {exec} from '../lib/system.js'
import {When, Then} from '@cucumber/cucumber'
import * as path from 'pathe'
import fs from 'fs-extra'
import {strict as assert} from 'assert'

interface ExtensionConfiguration {
  configuration: {
    name: string
  }
  outputPath: string
}

When(
  /I create a (.+) app named (.+) with (.+) as package manager/,
  {timeout: 5 * 60 * 1000},
  async function (appType: string, appName: string, packageManager: string) {
    let template
    switch (appType) {
      case 'remix':
        template = 'https://github.com/Shopify/shopify-app-template-remix'
        break
      case 'extension-only':
        template = 'https://github.com/Shopify/shopify-app-template-none'
        break
      default:
        throw new Error(`Unknown app type: ${appType}`)
    }

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
        template,
      ],
      {env: {...process.env, ...this.temporaryEnv, NODE_OPTIONS: '', FORCE_COLOR: '0'}},
    )
    const hyphenatedAppName = stdout?.match(/([\w-]+) is ready for you to build!/)?.[1] ?? appName
    this.appDirectory = path.join(this.temporaryDirectory, hyphenatedAppName)
    // we need to disable this on CI otherwise pnpm will crash complaining that there is no lockfile
    await fs.appendFile(path.join(this.appDirectory, '.npmrc'), 'frozen-lockfile=false\n')
  },
)

Then(
  /I have an app named (.+) generated from the template with (.+) as package manager/,
  {},
  async function (_appName: string, packageManager: string) {
    const {stdout} = await this.execCLI(['app', 'info', '--path', this.appDirectory, '--json'])
    const results = JSON.parse(stdout)
    assert.equal(results.packageManager, packageManager)
  },
)

Then(/I build the app/, {timeout: 2 * 60 * 1000 * 1000}, async function () {
  await this.execCLI(['app', 'build', '--path', this.appDirectory])
})

Then(/all the extensions are built/, {timeout: 2 * 60 * 1000 * 1000}, async function () {
  const appInfo = await this.appInfo()
  const extensionsMissingBuildFile = appInfo.allExtensions.filter((extension: ExtensionConfiguration) => {
    const buildFilePath = extension.outputPath

    return !fs.pathExistsSync(buildFilePath)
  })

  if (extensionsMissingBuildFile.length) {
    const extensionNames = extensionsMissingBuildFile.map(
      (extensions: ExtensionConfiguration) => extensions.configuration.name,
    )
    assert.fail(`Extensions without built file:\n${extensionNames.join(', ')}`)
  }
})

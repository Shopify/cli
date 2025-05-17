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

/**
 * Ensures that a minimal shopify.app.toml file exists in the app directory
 */
async function ensureAppToml(appDirectory: string) {
  const tomlPath = path.join(appDirectory, 'shopify.app.toml')
  if (!fs.existsSync(tomlPath)) {
    // Create a minimal shopify.app.toml file with required fields
    const minimalToml = `
name = "MyExtendedApp"
scopes = "write_products"
    `.trim()
    await fs.writeFile(tomlPath, minimalToml)
  }
}

/**
 * Ensures that a package.json file exists in the app directory
 */
async function ensurePackageJson(appDirectory: string) {
  const packageJsonPath = path.join(appDirectory, 'package.json')
  if (!fs.existsSync(packageJsonPath)) {
    // Create a basic package.json file
    const packageJson = {
      name: 'my-extended-app',
      version: '1.0.0',
      description: 'A Shopify app',
      main: 'index.js',
      dependencies: {},
      packageManager: 'npm',
    }
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2))
  }
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

    // Ensure .npmrc exists before appending to it
    const npmrcPath = path.join(this.appDirectory, '.npmrc')
    await fs.ensureFile(npmrcPath)
    // we need to disable this on CI otherwise pnpm will crash complaining that there is no lockfile
    await fs.appendFile(npmrcPath, 'frozen-lockfile=false\n')

    // Ensure shopify.app.toml exists in the app directory
    await ensureAppToml(this.appDirectory)

    // Ensure package.json exists in the app directory
    await ensurePackageJson(this.appDirectory)
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

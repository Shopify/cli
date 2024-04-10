import {executables} from '../lib/constants.js'
import {exec} from '../lib/system.js'
import {AppInfo} from '../world/index.js'
import * as path from 'pathe'
import {When, Then} from '@cucumber/cucumber'
import fs from 'fs-extra'
import {strict as assert} from 'assert'

When(
  /I create an extension named (.+) of type ([^\s]+) and flavor (.+)$/,
  {timeout: 5 * 60 * 1000},
  async function (name: string, type: string, flavor: string) {
    await generateExtension({
      name,
      type,
      directory: this.appDirectory,
      extraArgs: ['--flavor', flavor],
      env: {...process.env, ...this.temporaryEnv, NODE_OPTIONS: ''},
    })
  },
)

When(
  /I create an extension named (.+) of type ([^\s]+)$/,
  {timeout: 5 * 60 * 1000},
  async function (name: string, type: string) {
    await generateExtension({
      name,
      type,
      directory: this.appDirectory,
      extraArgs: [],
      env: {...process.env, ...this.temporaryEnv, NODE_OPTIONS: ''},
    })
  },
)

Then(
  /I have an extension named (.+) of type ([^\s]+) and flavor (.+)$/,
  {},
  async function (extName: string, extType: string, flavor: string) {
    const appInfo: AppInfo = await this.appInfo()
    const extension = this.findExtension(appInfo, extName)
    if (!extension) assert.fail(`Extension not created! Config:\n${JSON.stringify(appInfo.allExtensions, null, 2)}`)
    assert.equal(extension.configuration.type, extType)

    let fileExtension

    switch (flavor) {
      case 'react':
        fileExtension = 'jsx'
        break
      case 'typescript-react':
        fileExtension = 'tsx'
        break
      case 'typescript':
        fileExtension = 'ts'
        break
      case 'vanilla-js':
        fileExtension = 'js'
        break
      default:
        fileExtension = 'js'
    }

    assert.equal(extension.entrySourceFilePath.split('/').pop(), `index.${fileExtension}`)
  },
)

Then(/I have an extension named (.+) of type ([^\s]+)$/, {}, async function (extName: string, extType: string) {
  const appInfo: AppInfo = await this.appInfo()
  const extension = this.findExtension(appInfo, extName)
  if (!extension) assert.fail(`Extension not created! Config:\n${JSON.stringify(appInfo, null, 2)}`)
  assert.equal(extension.configuration.type, extType)
})

Then(/I do not have an extension named (.+) of type ([^\s]+)/, {}, async function (extName: string, _extType: string) {
  const appInfo: AppInfo = await this.appInfo()
  const extension = this.findExtension(appInfo, extName)
  assert.equal(extension, undefined)
})

Then(/The extension named (.+) contains the theme extension directories/, {}, async function (extName: string) {
  const appInfo: AppInfo = await this.appInfo()
  const extension = this.findExtension(appInfo, extName)
  if (!extension) assert.fail(`Extension not created! Config:\n${JSON.stringify(appInfo, null, 2)}`)
  const expectedDirectories = ['assets', 'blocks', 'locales', 'snippets']

  const nonExistingPaths = expectedDirectories
    .flatMap((directory) => {
      return [path.join(extension.directory, directory), path.join(extension.directory, directory, '.gitkeep')]
    })
    .filter((expectedPath) => {
      return !fs.pathExistsSync(expectedPath)
    })
  if (nonExistingPaths.length !== 0) {
    assert.fail(`The following paths were not found in the theme extension: ${nonExistingPaths.join(', ')}`)
  }
})

interface GenerateExtensionArgs {
  name: string
  type: string
  directory: string
  extraArgs: string[]
  env: {[key: string]: string}
}
async function generateExtension({name, type, directory, extraArgs, env}: GenerateExtensionArgs) {
  try {
    await exec(
      'node',
      [
        executables.cli,
        'app',
        'generate',
        'extension',
        '--name',
        name,
        '--path',
        directory,
        '--template',
        type,
        ...extraArgs,
      ],
      {env},
    )
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    assert.ok(true)
  }
}

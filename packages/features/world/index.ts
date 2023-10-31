import {executables} from '../lib/constants.js'
import {exec, ExecOptions} from '../lib/system.js'
import {setWorldConstructor} from '@cucumber/cucumber'

export interface WorldConstructorParams {
  temporaryDirectory: string
}

export interface AppInfo {
  allExtensions: Extension[]
}

export interface Extension {
  configuration: ExtensionConfiguration
  directory: string
  entrySourceFilePath: string
}

export interface ExtensionConfiguration {
  name: string
  type: string
  handle?: string
}

export class World {
  public temporaryDirectory: string
  public temporaryEnv: {[key: string]: string} | undefined
  public appDirectory: string | undefined

  constructor({temporaryDirectory}: WorldConstructorParams) {
    this.temporaryDirectory = temporaryDirectory
  }

  public async appInfo() {
    if (!this.appDirectory) {
      throw new Error("An app hasn't been created. Make sure the acceptance test has a step to create an app.")
    }
    const {stdout} = await this.execCLI(['app', 'info', '--path', this.appDirectory, '--json'])
    return JSON.parse(stdout)
  }

  public async execCLI(args: string[], opts?: ExecOptions) {
    const options = opts ?? {}
    // we use a custom NODE_OPTIONS to use tsm-node/esm to transpile typescript,
    // but we need to unset it otherwise child processes will also try to use it
    options.env = {...process.env, ...this.temporaryEnv, ...options.env, NODE_OPTIONS: ''}
    return exec('node', [executables.cli, ...args], options)
  }

  public findExtension(appInfo: AppInfo, extName: string) {
    return appInfo.allExtensions.find((extension: {configuration: ExtensionConfiguration}) => {
      return extension.configuration.name === extName || extension.configuration.handle === extName.toLowerCase()
    })
  }
}

setWorldConstructor(World)

import {executables} from '../lib/constants'
import {exec} from '../lib/system'
import {setWorldConstructor} from '@cucumber/cucumber'

export interface WorldConstructorParams {
  temporaryDirectory: string
}

export class World {
  public temporaryDirectory: string
  public temporaryEnv: any | undefined
  public appDirectory: string | undefined

  constructor({temporaryDirectory}: WorldConstructorParams) {
    this.temporaryDirectory = temporaryDirectory
  }

  public async appInfo() {
    if (!this.appDirectory) {
      throw new Error("An app hasn't been created. Make sure the acceptance test has a step to create an app.")
    }
    const {stdout} = await exec(executables.cli, ['app', 'info', '--path', this.appDirectory], {
      env: {...process.env, ...this.temporaryEnv},
    })
    return JSON.parse(stdout)
  }
}

setWorldConstructor(World)

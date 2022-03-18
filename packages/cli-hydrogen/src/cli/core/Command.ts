import {FileSystem} from './FileSystem'
import {Package} from './Package'
import {Interface} from './Interface'
import {Workspace} from './Workspace'
import {Storage} from './Storage'
import {logError} from '../utilities'
import {Command as OclifCommand, Flags} from '@oclif/core'
import {path} from '@shopify/cli-kit'

export {Flags}

abstract class Command extends OclifCommand {
  readonly fs: FileSystem = new FileSystem()
  readonly store: Storage = new Storage({projectName: '@shopify/cli'})
  readonly package: Package = new Package()
  readonly interface: Interface = new Interface()
  readonly workspace: Workspace = new Workspace()

  logError: (error: Error, log: (message: string) => void) => void = logError

  name?: string
  _root: string = process.cwd()

  set root(val: string) {
    const root = path.resolve(val)
    this._root = root
    this.fs.root = root
    this.package.root = root
  }

  get root() {
    return this._root
  }

  async init() {}

  async finally(err: Error) {
    return super.finally(err)
  }

  async catch(err: Error) {
    this.logError(err, this.interface.say.bind(this))

    return super.catch(err)
  }
}

export default Command

import {errorHandler, registerCleanBugsnagErrorsFromWithinPlugins} from './error-handler.js'
import {isDebug} from '../environment/local.js'
import {Command, Interfaces} from '@oclif/core'

// eslint-disable-next-line import/no-anonymous-default-export
export default abstract class extends Command {
  async catch(error: Error & {exitCode?: number | undefined}) {
    errorHandler(error)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async init(): Promise<any> {
    if (!isDebug()) {
      // This function runs just prior to `run`
      registerCleanBugsnagErrorsFromWithinPlugins(this.config.plugins)
    }
    return super.init()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async parseWithPresets<TF, TA extends {[name: string]: any}>(
    options?: Interfaces.Input<TF>,
    argv?: string[],
  ): Promise<
    Omit<Interfaces.ParserOutput<TF, TA>, 'flags' | 'args'> & {
      flags: {[name: string]: unknown}
      args: {[name: string]: unknown}
    }
  > {
    const parsed = await super.parse(options, argv)
    const flags = {...presets(), ...parsed.flags}
    return {...parsed, flags}
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function presets(): {[name: string]: any} {
  return {verbose: true}
}

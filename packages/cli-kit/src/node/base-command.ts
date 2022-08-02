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

  protected override async parse<TF, TA extends {[name: string]: unknown}>(
    options?: Interfaces.Input<TF> | undefined,
    argv?: string[] | undefined,
  ): Promise<Interfaces.ParserOutput<TF, TA>> {
    return super.parse(options, argv)
  }
}

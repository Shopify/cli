import {errorHandler, registerCleanBugsnagErrorsFromWithinPlugins} from './error-handler.js'
import {isDebug} from '../environment/local.js'
import {Command} from '@oclif/core'

// eslint-disable-next-line import/no-anonymous-default-export
export default abstract class extends Command {
  async catch(error: Error & {exitCode?: number | undefined}) {
    errorHandler(error, this.config)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async init(): Promise<any> {
    if (!isDebug()) {
      // This function runs just prior to `run`
      registerCleanBugsnagErrorsFromWithinPlugins(this.config.plugins)
    }
    return super.init()
  }
}

import {errorHandler} from './error-handler.js'
import {registerCleanBugsnagErrorsFromWithinPlugins} from '../bugsnag.js'
import {Command} from '@oclif/core'

// eslint-disable-next-line import/no-anonymous-default-export
export default abstract class extends Command {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async init(): Promise<any> {
    // This function runs just prior to `run`
    registerCleanBugsnagErrorsFromWithinPlugins(this.config.plugins)
    return super.init()
  }

  async catch(error: Error & {exitCode?: number | undefined}) {
    errorHandler(error)
  }
}

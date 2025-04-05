import {configurationFileNames} from '../constants.js'
import {AppLinkedInterface} from '../models/app/app.js'
import {handlers} from '../api/mock-scenarios/default/mock.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {setupServer} from 'msw/node'

/**
 * By forcing all commands to return `AppCommandOutput` we can be sure that during the run of each command we:
 * - Have an app that is correctly linked and loaded
 * - The user is authenticated
 * - A remoteApp is fetched
 */
export interface AppCommandOutput {
  app: AppLinkedInterface
}

export default abstract class AppCommand extends BaseCommand {
  environmentsFilename(): string {
    return configurationFileNames.appEnvironments
  }

  public abstract run(): Promise<AppCommandOutput>

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async init(): Promise<any> {
    const server = setupServer(...handlers)
    server.listen({onUnhandledRequest: 'bypass'})
    return super.init()
  }
}

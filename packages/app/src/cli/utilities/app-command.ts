import {configurationFileNames} from '../constants.js'
import {AppInterface} from '../models/app/app.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'

/**
 * By forcing all commands to return `AppCommandOutput` we can be sure that during the run of each command we:
 * - Have an app that is correctly linked and loaded
 * - The user is authenticated
 * - A remoteApp is fetched
 */
export interface AppCommandOutput {
  // PENDING: Use AppLinkedInterface
  app: AppInterface
}

export default abstract class AppCommand extends BaseCommand {
  environmentsFilename(): string {
    return configurationFileNames.appEnvironments
  }

  public abstract run(): Promise<AppCommandOutput>
}

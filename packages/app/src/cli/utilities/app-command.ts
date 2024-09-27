import {configurationFileNames} from '../constants.js'
import {AppInterface} from '../models/app/app.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'

/**
 * By forcing all commands to return `AppCommandOutput` we can be sure that during the run of each command we:
 * - Authenticate the user (PENDING)
 * - Load an app
 */
export interface AppCommandOutput {
  // session: PartnersSession (PENDING)
  app: AppInterface
}

export default abstract class AppCommand extends BaseCommand {
  environmentsFilename(): string {
    return configurationFileNames.appEnvironments
  }

  public abstract run(): Promise<AppCommandOutput>
}

import {configurationFileNames} from '../constants.js'
import {AppInterface} from '../models/app/app.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import BaseCommand from '@shopify/cli-kit/node/base-command'

/**
 * By forcing all commands to return `AppCommandOutput` we can be sure that during the run of each command we:
 * - Authenticate the user
 * - Load an app
 */
export interface AppCommandOutput {
  app: AppInterface
}

export default abstract class AppCommand extends BaseCommand {
  environmentsFilename(): string {
    return configurationFileNames.appEnvironments
  }

  public async run(): Promise<AppCommandOutput> {
    throw new AbortError('You should not call this method directly, implement it in a subclass')
  }
}

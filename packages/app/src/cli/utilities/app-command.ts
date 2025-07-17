import {configurationFileNames} from '../constants.js'
import {AppInterface} from '../models/app/app.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'

interface AppCommandOutput {
  app: AppInterface
}

export default abstract class AppCommand extends BaseCommand {
  environmentsFilename(): string {
    return configurationFileNames.appEnvironments
  }

  public abstract run(): Promise<AppCommandOutput>
}

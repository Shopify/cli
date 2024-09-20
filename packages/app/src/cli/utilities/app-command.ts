import {configurationFileNames} from '../constants.js'
import {UserID} from '../services/context/partner-account-info.js'
import {AppInterface} from '../models/app/app.js'
import Command from '@shopify/cli-kit/node/base-command'

export interface AppCommandOutput {
  userId: UserID
  app: AppInterface
}
export default abstract class AppCommand extends Command {
  environmentsFilename(): string {
    return configurationFileNames.appEnvironments
  }

  async run(): Promise<AppCommandOutput> {
    // Do nothing
    return Promise.reject()
  }
}

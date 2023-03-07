import {configurationFileNames} from '../constants.js'
import Command from '@shopify/cli-kit/node/base-command'

export default abstract class AppCommand extends Command {
  environmentsFilename(): string {
    return configurationFileNames.appEnvironments
  }
}

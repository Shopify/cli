import {configurationFileNames} from '../constants.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'

export default abstract class AppCommand extends BaseCommand {
  environmentsFilename(): string {
    return configurationFileNames.appEnvironments
  }
}

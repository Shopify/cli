import {configurationFileNames} from '../constants.js'
import {AppLinkedInterface} from '../models/app/app.js'
import {DemoStrategy} from '@shopify/cli'
import BaseCommand from '@shopify/cli-kit/node/base-command'

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

  public setDemoStrategy(strategy: DemoStrategy) {
    this.demoStrategy = strategy
    return this
  }
}

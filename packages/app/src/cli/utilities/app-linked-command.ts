import AppCommand from './app-command.js'
import {AppLinkedInterface} from '../models/app/app.js'

/**
 * By forcing all commands to return `AppLinkedCommandOutput` we can be sure that during the run of each command we:
 * - Have an app that is correctly linked and loaded
 * - The user is authenticated
 * - A remoteApp is fetched
 */
export interface AppLinkedCommandOutput {
  app: AppLinkedInterface
}

export default abstract class AppLinkedCommand extends AppCommand {
  public abstract run(): Promise<AppLinkedCommandOutput>
}

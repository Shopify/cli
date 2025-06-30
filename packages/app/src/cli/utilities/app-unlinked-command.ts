import AppCommand from './app-command.js'
import {AppInterface} from '../models/app/app.js'

export interface AppUnlinkedCommandOutput {
  app: AppInterface
}

/**
 * This command is used to run commands that exceptionally don't require authentication or a linked app.
 */
export default abstract class AppUnlinkedCommand extends AppCommand {
  public abstract run(): Promise<AppUnlinkedCommandOutput>
}

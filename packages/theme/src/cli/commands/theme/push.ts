import {Command} from '@oclif/core';

export default class Push extends Command {
  static description =
    'Uploads your local theme files to the connected store, overwriting the remote version if specified.';

  async run(): Promise<void> {}
}

import {Command} from '@oclif/core';

export default class Push extends Command {
  static description =
    'Uploads the current theme as a development theme to the connected store, then prints theme editor and preview URLs to your terminal. While running, changes will push to the store in real time.';

  async run(): Promise<void> {}
}

import {Command} from '@oclif/core';

export default class Package extends Command {
  static description =
    'Package a theme to manually upload it to the Online Store.';

  async run(): Promise<void> {}
}

import {Command, Flags} from '@oclif/core';
import {template} from 'utils/paths';
import init from 'services/init';

export default class Init extends Command {
  static description = 'Create a new Shopify app';
  static flags = {
    name: Flags.string({
      char: 'n',
      description: 'The name of the app to be initialized',
      hidden: false,
    }),
  };

  async run(): Promise<void> {
    const templatePath = await template('app');
    const name = 'name';
    await init(name, templatePath);
  }
}

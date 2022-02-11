import {Command, Flags} from '@oclif/core';
import {path} from '@shopify/cli-kit';

import initPrompt from '../prompts/init';
import initService from '../services/init';

export default class Init extends Command {
  static flags = {
    name: Flags.string({
      char: 'n',
      hidden: false,
    }),
    path: Flags.string({
      char: 'p',
      hidden: false,
    }),
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(Init);
    const directory = flags.path ? path.resolve(flags.path) : process.cwd();
    const promptAnswers = await initPrompt({
      name: flags.name,
    });
    await initService({
      name: promptAnswers.name,
      directory,
    });
  }
}

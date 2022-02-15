import {Command, Flags} from '@oclif/core'
import {path} from '@shopify/cli-kit';

import {extensions} from '../../../constants';
import scaffoldExtensionPrompt from '../../../prompts/scaffold/extension';

export default class AppScaffoldExtension extends Command {
  static description = 'Scaffold an App Extension'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ];

  static flags = {
    type: Flags.string({
      char: 't',
      hidden: false,
      description: 'extension type',
      options: extensions.types,
    }),
    name: Flags.string({
      char: 'n',
      hidden: false,
      description: 'name of your extension',
    }),
  };

  static args = [{name: 'file'}]

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(AppScaffoldExtension)
    const promptAnswers = await scaffoldExtensionPrompt({
      type: flags.type,
      name: flags.name,
    });
    this.log(JSON.stringify(promptAnswers));
  }
}

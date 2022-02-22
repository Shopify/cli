import {Command, Flags} from '@oclif/core';
import {file, path} from '@shopify/cli-kit';

import {extensions} from '../../../constants';
import scaffoldExtensionPrompt from '../../../prompts/scaffold/extension';
import {load as loadApp, App} from '../../../app/app';
import extensionInitService from '../../../../services/extensionInit';

export default class AppScaffoldExtension extends Command {
  static description = 'Scaffold an App Extension';
  static examples = ['<%= config.bin %> <%= command.id %>'];

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
    path: Flags.string({
      char: 'p',
      hidden: true,
      description: 'the path to your app directory',
    }),
  };

  static args = [{name: 'file'}];

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(AppScaffoldExtension);
    const directory = flags.path ? path.resolve(flags.path) : process.cwd();
    const parentApp: App = await loadApp(directory);
    const promptAnswers = await scaffoldExtensionPrompt({
      extensionType: flags.type,
      name: flags.name,
    });
    const {extensionType, name} = promptAnswers;
    await extensionInitService({
      ...promptAnswers,
      parentApp,
      log: this.log.bind(this),
    });
    this.log(`Extension ${name} generated successfully!`);
  }
}

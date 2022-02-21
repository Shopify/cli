import {fileURLToPath} from 'url';
import {Command, Flags} from '@oclif/core'
import {file, path, template, error} from '@shopify/cli-kit';
import {template as getTemplatePath} from '../utils/paths';

async function getTemplatePath(name: string): Promise<string> {
  const templatePath = await path.findUp(`templates/${name}`, {
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    type: 'directory',
  });
  if (templatePath) {
    return templatePath;
  } else {
    throw new error.Bug(
      `Couldn't find the template ${name} in @shopify/app.`,
    );
  }
}

import {extensions} from '../../../constants';
import scaffoldExtensionPrompt from '../../../prompts/scaffold/extension';
import { load as loadApp, App } from '../../../app/app';

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
    path: Flags.string({
      char: 'p',
      hidden: true,
      description: 'the path to your app directory'
    }),
  };

  static args = [{name: 'file'}]

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(AppScaffoldExtension)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd();
    const parentApp: App = await loadApp(directory);
    const promptAnswers = await scaffoldExtensionPrompt({
      extensionType: flags.type,
      name: flags.name,
    });
    const { extensionType, name } = promptAnswers;
    const templatePath = await getTemplatePath('extensions');
    const extensionDirectory = path.join(parentApp.directory, 'extensions', name);
    this.log("Generating extension directory");
    await file.mkdir(extensionDirectory);
    const log = this.log.bind(this);
    async function writeFromTemplate(filename: string, alias: string = filename) {
        log(`Generating ${alias} in ${extensionDirectory}`);
        const templateItemPath = path.join(templatePath, filename);
        const content = await file.read(templateItemPath);
        const contentOutput = await template(content)(promptAnswers);
        const fullpath = path.join(extensionDirectory, alias);
        await file.write(fullpath, contentOutput);
    }
    await Promise.all(
      [
        [".shopify.extension.toml"],
        [`${extensionType}.jsx`, "index.jsx"]
      ].map(async (fileDetails) => await writeFromTemplate(...fileDetails))
    );
    this.log("Extension generated!")
  }
}

import Listr from 'listr';
import {Command, Flags} from '@oclif/core';
import {path} from '@shopify/support';
import minimist from 'minimist';
import {Plop, run} from 'plop';
import {template as templatePath} from 'utils/paths';

const args = process.argv.slice(2);
const argv = minimist(args);

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
    const _templatePath = await templatePath('app');
    const plopWorkflow = [
      {
        title: 'Creating from Basic App Template',
        task: () =>
          Plop.launch(
            {
              cwd: process.cwd(),
              configPath: path.join(
                __dirname,
                '../../templates/app-plopfile.js',
              ),
              require: argv.require,
              completion: argv.completion,
            },
            (env) => {
              const options = {
                ...env,
                dest: process.cwd(),
              };
              return run(options, undefined, true);
            },
          ),
      },
    ];

    const tasks = new Listr(plopWorkflow);

    tasks
      .run()
      .then(() => {
        console.log('The app has been successfully created');
      })
      .catch((err) => {
        console.error(err);
      });
  }
}

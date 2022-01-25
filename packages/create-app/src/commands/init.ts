import Listr from 'listr';
import {Command} from '@oclif/core';
import path from "node:path";
import minimist from "minimist";
import {Plop, run} from "plop";
const args = process.argv.slice(2);
const argv = minimist(args);

export default class Init extends Command {
  static description = 'Create a new Shopify app';
  static flags = {};

  async run(): Promise<void> {
    const gitWorkflow = [
      {
        title: 'Git',
        task: () => {
          return new Listr(
            [
              {
                title: 'Cloning the template',
                task: () => new Promise((resolve) => setTimeout(resolve, 3000)),
              },
            ],
            {concurrent: true},
          );
        },
      },
      {
        title: 'Initializing the content',
        task: () => new Promise((resolve) => setTimeout(resolve, 3000)),
      },
      {
        title: 'Installing dependencies',
        task: () => new Promise((resolve) => setTimeout(resolve, 3000)),
      },
    ];
    gitWorkflow; // TypeScript linting error without this

    const plopWorkflow = [
      {
        title: 'Creating from Basic App Template',
        task: () => Plop.launch({
          cwd: process.cwd(),
          configPath: path.join(__dirname, '../../templates/app-plopfile.js'),
          require: argv.require,
          completion: argv.completion
        }, env => {
          const options = {
            ...env,
            dest: process.cwd()
          }
          return run(options, undefined, true)
        })
      }
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

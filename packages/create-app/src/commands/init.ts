import Listr from 'listr';
import {Command} from '@oclif/core';
import { Plop, run } from "plop";

export default class Init extends Command {
  static description = 'Create a new Shopify app';

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
    ]);

    const plopWorkflow = [
      {
        title: 'Creating from Basic App Template',
        task: () => {
          Plop.prepare({
            cwd: process.cwd(),
            configPath: path.join(__dirname, '../../templates/app/plopfile.js'),
          }, env => Plop.execute(env, run));
        }
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

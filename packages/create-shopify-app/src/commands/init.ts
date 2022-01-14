import Listr from 'listr';
import {Command} from '@oclif/core';

export default class Init extends Command {
  static description = 'Create a new Shopify app';

  async run(): Promise<void> {
    const tasks = new Listr([
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

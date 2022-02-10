// import type {Env} from 'types';
import {resolve} from 'path';

import {HelpfulError} from '../../utilities';
import Command from '../../core/Command';

import {MiniOxygen} from './preview/mini-oxygen/core';

const port = 4000;
export default class Preview extends Command {
  static description =
    'Preview a hydrogen worker build in a worker environment.';

  static examples = [`$ shopify hydrogen preview`];

  static flags = {
    ...Command.flags,
  };

  static args = [];

  async run(): Promise<void> {
    const hasWorkerBuild = await this.fs.hasFile('dist/worker/worker.js');

    if (!hasWorkerBuild) {
      throw new HelpfulError({
        title: 'worker.js not found',
        content: 'A worker build is required for this command.',
        suggestion: () =>
          `Run \`yarn run build\` to generate a worker build and try again.`,
      });
    }

    const files = await this.fs.glob('dist/client/**/*');

    files.forEach((file) => {
      this.interface.say(file);
    });

    const mf = new MiniOxygen({
      buildCommand: 'yarn build',
      globals: {Oxygen: {}},
      scriptPath: resolve(this.root, 'dist/worker/worker.js'),
      sitePath: resolve(this.root, 'dist/client'),
    });

    const app = await mf.createServer({assets: files});

    app.listen(port, () => {
      this.interface.say(
        `\nStarted miniOxygen server. Listening at http://localhost:${port}\n`,
      );
    });
  }
}

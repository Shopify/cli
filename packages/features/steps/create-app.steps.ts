import {Then} from '@cucumber/cucumber';

import {executables, directories} from '../lib/constants';
import {exec} from '../lib/system';

Then(
  /I create an app named (.+) with (.+) as dependency manager/,
  {timeout: 2 * 60 * 1000},
  async function (appName: string, dependencyManager: string) {
    await exec(executables.createApp, [
      '--name',
      appName,
      '--path',
      this.temporaryDirectory,
      '--dependency-manager',
      dependencyManager,
      '--shopify-cli-version',
      `file:${directories.packages.cli}`,
      '--shopify-app-version',
      `file:${directories.packages.app}`,
    ]);
  },
);

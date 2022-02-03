import {When} from '@cucumber/cucumber';
import path from 'pathe';

import {exec} from '../lib/system';

When(/I create an app named (.+)/, function (appName: string) {
  const appPath = path.join(this.temporaryDirectory, appName);
  exec(`${this.createAppExecutable} --name ${appName} --path ${appPath}`);
});

import {Then} from '@cucumber/cucumber';
import path from 'pathe';

import {exec} from '../lib/system';

Then(/I create an app named (.+)/, async function (appName: string) {
  const appPath = path.join(this.temporaryDirectory, appName);
  await exec(
    `${this.createAppExecutable} --name ${appName} --path ${appPath} --description 'Description'`,
  );
});

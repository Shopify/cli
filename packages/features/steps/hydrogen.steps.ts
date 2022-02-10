import {Then} from '@cucumber/cucumber';

import {exec} from '../lib/system';

Then(/I see Hydrogen's help menu/, async function () {
  await exec(this.cliExecutable, ['hydrogen', '--help']);
});

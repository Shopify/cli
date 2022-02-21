import {Then} from '@cucumber/cucumber';

import {executables} from '../lib/constants';
import {exec} from '../lib/system';

Then(/I see Hydrogen's help menu/, async function () {
  await exec(executables.cli, ['hydrogen', '--help']);
});

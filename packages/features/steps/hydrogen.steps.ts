import {executables} from '../lib/constants.js'
import {exec} from '../lib/system.js'
import {Then} from '@cucumber/cucumber'

Then(/I see Hydrogen's help menu/, async function () {
  await exec('node', [executables.cli, 'hydrogen', '--help'], {env: {...process.env, ...this.temporaryEnv}})
})

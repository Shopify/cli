import {executables} from '../lib/constants'
import {exec} from '../lib/system'
import {Then} from '@cucumber/cucumber'

Then(/I see Hydrogen's help menu/, async function () {
  await exec('node', [executables.cli, 'hydrogen', '--help'], {env: {...process.env, ...this.temporaryEnv}})
})

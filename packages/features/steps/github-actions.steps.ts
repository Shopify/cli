import {exec} from '../lib/system.js'
import {When, Then} from '@cucumber/cucumber'
import * as path from 'pathe'
import {strict as assert} from 'assert'
import {fileURLToPath} from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

When(/I look at the github actions we use/, async function () {
  const {stdout} = await exec('grep', ['-Roh', 'uses: \\S*', '.'], {cwd: path.join(__dirname, '../../../.github')})
  this.githubActions = stdout.split('\n').map((line: string) => line.split(' ')[1])
})

Then(/I see all non-official actions being pinned/, async function () {
  const remaining: string[] = this.githubActions.filter(
    // we skip the ones from github, from the repo or from Shopify
    (action: string) => !action.startsWith('actions/') && !action.startsWith('./') && !action.startsWith('Shopify/'),
  )
  const unpinned = remaining.filter(
    (action: string) =>
      // an example of pinned package:
      // pnpm/action-setup@646cdf48217256a3d0b80361c5a50727664284f2
      !action.match(/^[^@]+@[0-9a-f]+/),
  )
  const errorMessage = `The following unofficial github actions have not been pinned:\n\n${unpinned
    .map((el: string) => `  - ${el}`)
    .join(
      '\n',
    )}\n\nRun the bin/pin-github-actions.js script, verify that the action is not doing anything malicious, then commit your changes.`

  assert.equal(unpinned.length, 0, errorMessage)
})

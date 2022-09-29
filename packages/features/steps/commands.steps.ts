import {executables} from '../lib/constants'
import {exec} from '../lib/system'
import {Then} from '@cucumber/cucumber'
import * as fs from 'fs/promises'
import {strict as assert} from 'assert'

const errorMessage = `
SNAPSHOT TEST FAILED!

The result of 'yarn shopify commands' has changed! We run this to check that
all commands can load successfully.

It's normal to see this test fail when you add or remove a command in the CLI.
In this case you can run this command to regenerate the snapshot file:

$ yarn test:regenerate-snapshots

Then you can commit this change and this test will pass.

If instead you didn't mean to change a command, UH OH. Check the commands in
the diff below and figure out what is broken.
`

Then(/I see all available commands and they match the snapshot/, async function () {
  const commandFlags = ['commands', '--no-header', '--columns=Command,Plugin']
  const result: string = (
    await exec('node', [executables.cli, ...commandFlags], {env: {...process.env, ...this.temporaryEnv}})
  ).stdout.trimEnd()
  const snapshot: string = (await fs.readFile('snapshots/commands.txt', {encoding: 'utf8'})).trimEnd()

  assert.equal(snapshot, result, errorMessage)
})

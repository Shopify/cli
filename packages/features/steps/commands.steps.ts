import {When, Then} from '@cucumber/cucumber'
import * as fs from 'fs/promises'
import {strict as assert} from 'assert'

const errorMessage = `
SNAPSHOT TEST FAILED!

The result of 'shopify commands' has changed! We run this to check that
all commands can load successfully.

It's normal to see this test fail when you add or remove a command in the CLI.
In this case you can run this command to regenerate the snapshot file:

$ pnpm test:regenerate-snapshots

Then you can commit this change and this test will pass.

If instead you didn't mean to change a command, UH OH. Check the commands in
the diff below and figure out what is broken.
`

When(/I list the available commands/, async function () {
  const commandFlags = ['commands', '--tree']
  this.commandResult = (await this.execCLI(commandFlags)).stdout
})

Then(/I see all commands matching the snapshot/, async function () {
  const snapshot: string = await fs.readFile('snapshots/commands.txt', {encoding: 'utf8'})
  const normalize = (value: string) => value.replace(/\r\n/g, '\n').trimEnd()
  assert.equal(normalize(snapshot), normalize(this.commandResult), errorMessage)
})

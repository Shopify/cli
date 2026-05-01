/* eslint-disable no-restricted-imports */
import {cliFixture as test} from '../setup/cli.js'
import {expect} from '@playwright/test'
import * as fs from 'fs/promises'
import * as path from 'path'
import {fileURLToPath} from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const snapshotPath = path.join(__dirname, '../data/snapshots/commands.txt')

const errorMessage = `
SNAPSHOT TEST FAILED!

The result of 'shopify commands --tree' has changed! We run this to check that
all commands can load successfully.

It's normal to see this test fail when you add or remove a command in the CLI.
In this case you can run this command to regenerate the snapshot file:

$ pnpm test:regenerate-snapshots

Then you can commit this change and this test will pass.

If instead you didn't mean to change a command, UH OH. Check the commands in
the diff below and figure out what is broken.
`

const normalize = (value: string) => value.replace(/\r\n/g, '\n').trimEnd()

test.describe('Command snapshot', () => {
  test('shopify commands --tree matches snapshot', async ({cli}) => {
    const result = await cli.exec(['commands', '--tree'])
    expect(result.exitCode, `commands --tree failed:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0)

    const snapshot = await fs.readFile(snapshotPath, {encoding: 'utf8'})
    expect(normalize(result.stdout), errorMessage).toBe(normalize(snapshot))
  })
})

import {spawnSync} from 'node:child_process'
import {mkdtempSync, readFileSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import * as path from 'node:path'
import {fileURLToPath} from 'node:url'

// Verifies that `shopify commands --tree` matches the committed snapshot.
// This proves every command can load, and catches command additions/removals
// that were not regenerated. It used to run inside the Playwright E2E suite,
// where its failures were misclassified as E2E flake.

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const cliBin = path.join(repoRoot, 'packages/cli/bin/run.js')
const snapshotPath = path.join(repoRoot, 'packages/e2e/data/snapshots/commands.txt')

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

const normalize = (value) => value.replace(/\r\n/g, '\n').trimEnd()

const env = {...process.env, FORCE_COLOR: '0'}
delete env.DEBUG

const result = spawnSync('node', [cliBin, 'commands', '--tree'], {encoding: 'utf8', env})

if (result.status !== 0) {
  console.error(`::error::commands --tree failed (exit ${result.status})\nstdout: ${result.stdout}\nstderr: ${result.stderr}`)
  process.exit(1)
}

const actual = normalize(result.stdout)
const expected = normalize(readFileSync(snapshotPath, 'utf8'))

if (actual !== expected) {
  console.error(errorMessage)
  const actualPath = path.join(mkdtempSync(path.join(tmpdir(), 'commands-snapshot-')), 'commands.txt')
  writeFileSync(actualPath, `${actual}\n`)
  spawnSync('git', ['diff', '--no-index', snapshotPath, actualPath], {stdio: 'inherit'})
  process.exit(1)
}

console.log('commands --tree matches snapshot')

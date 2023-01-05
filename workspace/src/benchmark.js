#!/usr/bin/env node

import * as path from 'pathe'
import fg from 'fast-glob'
import * as url from 'node:url'
import {promises as fs} from 'node:fs'
import {createRequire} from 'node:module'
import {execa} from 'execa'

if (process.argv.length !== 3) {
  console.error('Usage: node benchmark.js output.json')
  process.exit(1)
}

const require = createRequire(import.meta.url)
const colors = require('ansi-colors')

const rootDirectory = path.join(url.fileURLToPath(new URL('.', import.meta.url)), '../..')
const workspaceDirectory = path.join(rootDirectory, 'workspace')

/**
 * LINT 2 - Startup time
 * ----
 * This lint runs all the CLI commands and fails if the startup time for any is above a threshold.
 */
console.info(colors.green.bold(`Measuring startup time for all commands`))
const results = {}
for (const pluginName of ['app', 'theme']) {
  const oclifManifestPath = path.join(rootDirectory, 'packages', pluginName, 'oclif.manifest.json')
  const oclifManifest = JSON.parse(await fs.readFile(oclifManifestPath))
  const commands = Object.keys(oclifManifest.commands).map((command) => command.split(':'))
  for (const command of commands) {
    const startTimestamp = Date.now()
    const {stdout} = await execa(path.join(rootDirectory, 'packages/cli/bin/dev.js'), command, {
      env: {SHOPIFY_CLI_ENV_STARTUP_PERFORMANCE_RUN: '1'},
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const endTimestamp = JSON.parse(
      stdout.replace('SHOPIFY_CLI_TIMESTAMP_START', '').replace('SHOPIFY_CLI_TIMESTAMP_END', ''),
    ).timestamp
    const diff = endTimestamp - startTimestamp
    console.log(`Startup time for 'shopify ${command.join(' ')}': ${diff} ms`)
    results[command.join(' ')] = diff
  }
}

await fs.writeFile(path.resolve(process.argv[2]), JSON.stringify(results, null, 2))

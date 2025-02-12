#!/usr/bin/env node

import * as path from 'pathe'
import {execa} from 'execa'
import {temporaryDirectoryTask} from 'tempy'
import {setOutput} from '@actions/core'
import {promises as fs} from 'fs'
import {logMessage, logSection} from './utils/log.js'
import * as url from 'url'
import {homedir} from 'os'

const TOTAL_TIMES = 1
const DEBUG = true

async function benchmark(directory, {name}) {
  const results = {}
  logSection(`Benchmarking ${name}`)

  const oclifManifestPath = path.join(directory, 'packages', 'cli', 'oclif.manifest.json')
  const oclifManifest = JSON.parse(await fs.readFile(oclifManifestPath))
  for (const pluginName of ['app']) {
    let commands = Object.keys(oclifManifest.commands).map((command) => command.split(':'))
    commands = commands.filter((command) => command[0] === pluginName)

    if (DEBUG) {
      // commands = commands.slice(0, 1)
      commands = [
        ['app', 'info'],
        ['app', 'build'],
        ['app', 'env', 'show'],
      ]
    }

    for (const command of commands) {
      const startTimestamp = Date.now()
      const {stdout} = await execa(path.join(directory, 'packages/cli/bin/dev.js'), command, {
        env: {
          SHOPIFY_CLI_ENV_STARTUP_PERFORMANCE_RUN: '1',
          SHOPIFY_FLAG_PATH: path.join(homedir(), 'Documents/shopify_apps/benchmark-app'),
        },
        cwd: directory,
        stdout: 'pipe',
        stderr: 'pipe',
      })
      // const endTimestamp = JSON.parse(
      //   stdout.replace('SHOPIFY_CLI_TIMESTAMP_START', '').replace('SHOPIFY_CLI_TIMESTAMP_END', ''),
      // ).timestamp
      const endTimestamp = Date.now()
      const diff = endTimestamp - startTimestamp
      const commandId = command.join(' ')
      logMessage(`${commandId}: ${diff} ms`)
      results[commandId] = diff
    }
  }
  return results
}

async function report(results) {
  const rows = []
  const commands = Object.entries(results).sort()

  // Find the longest command name for padding
  const maxCommandLength = Math.max(...commands.map(([cmd]) => cmd.length))

  for (const [command, time] of commands) {
    // Pad the command with spaces to align the Time column
    const paddedCommand = `\`${command}\``.padEnd(maxCommandLength + 2)
    rows.push(['⚪️', paddedCommand, `${Math.round(time)} ms`])
  }

  const markdownTable = `| Status | Command${' '.repeat(maxCommandLength - 5)} | Time |
|---------|${'-'.repeat(maxCommandLength + 2)}|------|
${rows.map((row) => `| ${row.join(' | ')} |`).join('\n')}
`
  console.log(markdownTable)
}

await temporaryDirectoryTask(async () => {
  const currentDirectory = path.join(url.fileURLToPath(new URL('.', import.meta.url)), '../..')
  const currentBenchmark = await benchmark(currentDirectory, {name: 'current'})
  await report(currentBenchmark)
})

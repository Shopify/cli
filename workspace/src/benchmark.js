#!/usr/bin/env node

import * as path from 'pathe'
import fg from 'fast-glob'
import * as url from 'url'
import {createRequire} from 'module'
import {execa} from 'execa'
import {temporaryDirectoryTask} from 'tempy'
import git from 'simple-git'
import {setOutput} from '@actions/core'
import {promises as fs, existsSync} from 'fs'
import {cloneCLIRepository} from './utils/git.js'
import {logMessage, logSection} from './utils/log.js'

const TOTAL_TIMES = 1

async function benchmark(directory, {name}) {
  const results = {}
  for (let time = 1; time < TOTAL_TIMES; time++) {
    logSection(`Benchmarking ${name}. Time ${time}`)

    const oclifManifestPath = path.join(directory, 'packages', 'cli', 'oclif.manifest.json')
    const oclifManifest = JSON.parse(await fs.readFile(oclifManifestPath))
    for (const pluginName of ['app']) {
      // 'theme'
      let commands = Object.keys(oclifManifest.commands).map((command) => command.split(':'))
      commands = commands.filter((command) => command[0] === pluginName)
      for (const command of commands) {
        const startTimestamp = Date.now()
        const {stdout} = await execa(path.join(directory, 'packages/cli/bin/dev.js'), command, {
          env: {SHOPIFY_CLI_ENV_STARTUP_PERFORMANCE_RUN: '1'},
          cwd: directory,
          stdout: 'pipe',
          stderr: 'pipe',
        })
        const endTimestamp = JSON.parse(
          stdout.replace('SHOPIFY_CLI_TIMESTAMP_START', '').replace('SHOPIFY_CLI_TIMESTAMP_END', ''),
        ).timestamp
        const diff = endTimestamp - startTimestamp
        const commandId = command.join(' ')
        logMessage(`${commandId}: ${diff} ms`)

        /**
         * We don't collect the results from the first and treat them
         * as a cache-warming run.
         */
        if (time > 1) {
          results[commandId] = [...(results[commandId] ?? []), diff]
        }
      }
    }
  }
  return results
}

async function report(currentBenchmark, baselineBenchmark) {
  const rows = []
  for (const command of Object.keys(currentBenchmark).sort()) {
    if (baselineBenchmark[command] === undefined) {
      rows.push(['⚪️', `\`${command}\``, 'N/A', `${currentBenchmark[command]} ms`, 'N/A'])
    } else {
      function round(number) {
        return Math.round(number * 100) / 100
      }
      const currentAverageTime = currentBenchmark[command].reduce((a, b) => a + b, 0) / currentBenchmark[command].length
      const baselineAverageTime =
        baselineBenchmark[command].reduce((a, b) => a + b, 0) / baselineBenchmark[command].length

      const diff = round((currentAverageTime / baselineAverageTime - 1) * 100)
      let icon = '⚪️'
      if (diff > 10) {
        rows.push([
          '🔴',
          `\`${command}\``,
          `${round(baselineAverageTime)} ms`,
          `${round(currentAverageTime)} ms`,
          `${diff} %`,
        ])
      }
    }
  }
  if (rows.length !== 0) {
    const markdownTable = `| Status | Command | Baseline (avg) | Current (avg) | Diff |
| ------- | -------- | ------- | ----- | ---- |
${rows.map((row) => `| ${row.join(' | ')} |`).join('\n')}
`
    setOutput(
      'report',
      `## Benchmark report
We detected a significant variation of startup time in the following commands.
Note that it might be related to external factors that influence the benchmarking.
If you believe that's the case, feel free to ignore the table below.
${markdownTable}
`,
    )
  }
}

await temporaryDirectoryTask(async (tmpDir) => {
  const baselineDirectory = await cloneCLIRepository(tmpDir)
  const currentDirectory = path.join(url.fileURLToPath(new URL('.', import.meta.url)), '../..')
  const baselineBenchmark = await benchmark(baselineDirectory, {name: 'baseline'})
  const currentBenchmark = await benchmark(currentDirectory, {name: 'current'})
  await report(currentBenchmark, baselineBenchmark)
})

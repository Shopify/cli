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

const require = createRequire(import.meta.url)
const colors = require('ansi-colors')

function logSection(title) {
  console.info(colors.green.bold(title))
}

function logMessage(message) {
  console.info(colors.gray(`  ${message}`))
}

async function cloneCLIRepository(tmpDir) {
  logSection('Setting up baseline: main branch')
  const directory = path.join(tmpDir, 'cli')
  logMessage('Cloning repository')
  await git().clone('https://github.com/Shopify/cli.git', directory)
  logMessage('Installing dependencies')
  await execa('pnpm', ['install'], {cwd: directory})
  logMessage('Building the project')
  await execa('pnpm', ['build'], {cwd: directory})
  return directory
}

async function benchmark(directory, results = {}, times = 5, {name}) {
  logSection(`Benchmarking ${name}. ${times} remaining`)

  for (const pluginName of ['app', 'theme']) {
    const oclifManifestPath = path.join(directory, 'packages', pluginName, 'oclif.manifest.json')
    const oclifManifest = JSON.parse(await fs.readFile(oclifManifestPath))
    const commands = Object.keys(oclifManifest.commands).map((command) => command.split(':'))
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
      results[commandId] = [...(results[commandId] ?? []), diff]
    }
  }

  if (times > 1) {
    return benchmark(directory, results, times - 1, {name})
  } else {
    return results
  }
}

async function report(currentBenchmark, baselineBenchmark) {
  const rows = []
  for (const command of Object.keys(currentBenchmark).sort()) {
    if (baselineBenchmark[command] === undefined) {
      rows.push(['⚪️', `\`${command}\``, 'N/A', `${currentBenchmark[command]} ms`, 'N/A'])
    } else {
      const currentAverageTime = currentBenchmark[command].reduce((a, b) => a + b, 0) / currentBenchmark[command].length
      const baselineAverageTime =
        baselineBenchmark[command].reduce((a, b) => a + b, 0) / baselineBenchmark[command].length

      const diff = Math.round((currentAverageTime / baselineAverageTime - 1) * 100 * 100) / 100
      let icon = '⚪️'
      if (diff < 8) {
        icon = '🟢'
      } else if (diff < 10) {
        icon = '🟡'
      } else {
        icon = '🔴'
      }
      rows.push([icon, `\`${command}\``, `${baselineAverageTime} ms`, `${currentAverageTime} ms`, `${diff} %`])
    }
  }
  const markdownTable = `| Status | Command | Baseline (avg) | Current (avg) | Diff |
| ------- | -------- | ------- | ----- | ---- |
${rows.map((row) => `| ${row.join(' | ')} |`).join('\n')}
`
  setOutput(
    'report',
    `## Benchmark report
The following table contains a summary of the startup time for all commands.
${markdownTable}
`,
  )
}

await temporaryDirectoryTask(async (tmpDir) => {
  const baselineDirectory = await cloneCLIRepository(tmpDir)
  const currentDirectory = path.join(url.fileURLToPath(new URL('.', import.meta.url)), '../..')
  const baselineBenchmark = await benchmark(baselineDirectory, {}, 3, {name: 'baseline'})
  const currentBenchmark = await benchmark(currentDirectory, {}, 3, {name: 'current'})
  await report(currentBenchmark, baselineBenchmark)
})

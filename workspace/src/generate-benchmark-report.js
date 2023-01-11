#!/usr/bin/env node

import {setOutput} from '@actions/core'
import * as path from 'pathe'
import fg from 'fast-glob'
import * as url from 'url'
import {promises as fs, existsSync} from 'fs'
import {createRequire} from 'module'
import {execa} from 'execa'
import {osMetadata} from './os-metadata.js'

const require = createRequire(import.meta.url)
const rootDirectory = path.join(url.fileURLToPath(new URL('.', import.meta.url)), '../..')

const baselineBenchmarkPath = path.join(path.join(rootDirectory, 'baseline-benchmark.json'))
const benchmarkPath = path.join(rootDirectory, 'benchmark.json')

function getOSMarkdownReport(osMetadata) {
  return `- Architecture: ${osMetadata.arch}
- Memory: ${osMetadata.memory}
- CPUS:
${osMetadata.cpus.map((cpu) => `  - ${cpu.model}, speed: ${cpu.speed}`).join('\n')}
`
}

if (!existsSync(baselineBenchmarkPath)) {
  setOutput(
    'report',
    `# Benchmark report
  Couldn't find baseline benchmark file to compare against.
  `,
  )
  process.exit(0)
}

if (!existsSync(benchmarkPath)) {
  setOutput(
    'report',
    `# Benchmark report
  Couldn't find benchmark file. Did you run the benchmark?
  `,
  )
  process.exit(0)
}

let baselineBenchmark = JSON.parse(await fs.readFile(baselineBenchmarkPath, 'utf8'))
if (!baselineBenchmark.commands) {
  baselineBenchmark = {
    commands: baselineBenchmark,
    os: osMetadata(),
  }
}
let benchmark = JSON.parse(await fs.readFile(benchmarkPath, 'utf8'))
if (!benchmark.commands) {
  benchmark = {
    commands: benchmark,
    os: osMetadata(),
  }
}

const rows = []
for (const command of Object.keys(benchmark).sort()) {
  if (baselineBenchmark[command] === undefined) {
    rows.push(['⚪️', `\`${command}\``, 'N/A', `${benchmark[command]} ms`, 'N/A'])
  } else {
    const diff = Math.round((benchmark[command] / baselineBenchmark[command] - 1) * 100 * 100) / 100
    let icon = '⚪️'
    if (diff < 8) {
      icon = '🟢'
    } else if (diff < 10) {
      icon = '🟡'
    } else {
      icon = '🔴'
    }
    rows.push([icon, `\`${command}\``, `${baselineBenchmark[command]} ms`, `${benchmark[command]} ms`, `${diff} %`])
  }
}

const markdownTable = `| Status | Command | Baseline | Current | Diff |
| ------- | -------- | ------- | ----- | ---- |
${rows.map((row) => `| ${row.join(' | ')} |`).join('\n')}
`
const environment
setOutput(
  'report',
  `## Benchmark report
The following table contains a summary of the startup time for all commands.
${markdownTable}

## OSs
### Baseline
${getOSMarkdownReport(baselineBenchmark.os)}
### Current
${getOSMarkdownReport(benchmark.os)}
`,
)

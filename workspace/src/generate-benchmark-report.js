#!/usr/bin/env node

import {setOutput} from '@actions/core'
import * as path from 'pathe'
import fg from 'fast-glob'
import * as url from 'node:url'
import {promises as fs, existsSync} from 'node:fs'
import {createRequire} from 'node:module'
import {execa} from 'execa'

const require = createRequire(import.meta.url)
const rootDirectory = path.join(url.fileURLToPath(new URL('.', import.meta.url)), '../..')

const baselineBenchmarkPath = path.join(path.join(rootDirectory, 'baseline-benchmark.json'))
const benchmarkPath = path.join(rootDirectory, 'benchmark.json')

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

const baselineBenchmark = JSON.parse(await fs.readFile(baselineBenchmarkPath, 'utf8'))
const benchmark = JSON.parse(await fs.readFile(benchmarkPath, 'utf8'))

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
setOutput(
  'report',
  `## Benchmark report
The following table contains a summary of the startup time for all commands.
${markdownTable}
`,
)

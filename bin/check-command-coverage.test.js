/* eslint-disable n/no-unsupported-features/node-builtins */
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtemp, mkdir, realpath, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {test} from 'node:test'

import {checkCoverage} from './check-command-coverage.js'

const checker = fileURLToPath(new URL('./check-command-coverage.js', import.meta.url))
const thresholds = {lines: 90, branches: 80, functions: 90}
const passingCounts = {
  lines: {total: 10, covered: 9},
  branches: {total: 5, covered: 4},
  functions: {total: 10, covered: 9},
}

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'coverage-check-')))
  const source = 'packages/example/src/command.ts'
  await mkdir(join(root, 'packages/example/src'), {recursive: true})
  await writeFile(join(root, source), 'export const command = true\n')
  return {
    root,
    source,
    scope: {files: [source], thresholds},
    summary: {total: passingCounts, [resolve(root, source)]: passingCounts},
    dispose: () => rm(root, {recursive: true, force: true}),
  }
}

test('passes exact targets and computes the selected aggregate', async () => {
  const value = await fixture()
  try {
    const result = await checkCoverage(value.scope, value.summary, value.root)
    assert.equal(result.passed, true)
    assert.equal(result.aggregate.lines.pct, 90)
    assert.equal(result.files[0].file, value.source)
    assert.match(result.files[0].sourceHash, /^[a-f0-9]{64}$/)
  } finally {
    await value.dispose()
  }
})

test('rejects a low file even when supplied percentages are high', async () => {
  const value = await fixture()
  try {
    value.summary[resolve(value.root, value.source)] = {
      ...passingCounts,
      lines: {total: 10, covered: 8, pct: 100},
    }
    const result = await checkCoverage(value.scope, value.summary, value.root)
    assert.equal(result.passed, false)
    assert.match(result.failures.join('\n'), /lines below 90%/)
  } finally {
    await value.dispose()
  }
})

test('fails when a scoped source file is absent from the report', async () => {
  const value = await fixture()
  try {
    const result = await checkCoverage(value.scope, {total: passingCounts}, value.root)
    assert.equal(result.aggregate, null)
    assert.match(result.failures[0], /Missing mapped coverage/)
  } finally {
    await value.dispose()
  }
})

test('reports empty branch and function metrics as not applicable', async () => {
  const value = await fixture()
  try {
    const counts = {...passingCounts, branches: {total: 0, covered: 0}, functions: {total: 0, covered: 0}}
    value.summary = {total: counts, [resolve(value.root, value.source)]: counts}
    const result = await checkCoverage(value.scope, value.summary, value.root)
    assert.equal(result.files[0].metrics.branches.pct, null)
    assert.equal(result.files[0].metrics.functions.passed, null)
  } finally {
    await value.dispose()
  }
})

test('does not pass a source file with no executable lines', async () => {
  const value = await fixture()
  try {
    const counts = {...passingCounts, lines: {total: 0, covered: 0}}
    value.summary = {total: counts, [resolve(value.root, value.source)]: counts}
    const result = await checkCoverage(value.scope, value.summary, value.root)
    assert.equal(result.passed, false)
    assert.match(result.failures[0], /No executable lines/)
  } finally {
    await value.dispose()
  }
})

for (const counts of [
  {total: 10, covered: 11},
  {total: -1, covered: 0},
  {total: 1.5, covered: 1},
  {total: 1},
  {total: 10, covered: '10'},
]) {
  test(`rejects invalid counts ${JSON.stringify(counts)}`, async () => {
    const value = await fixture()
    try {
      value.summary[resolve(value.root, value.source)] = {...passingCounts, lines: counts}
      await assert.rejects(checkCoverage(value.scope, value.summary, value.root), /integer counts/)
    } finally {
      await value.dispose()
    }
  })
}

test('rejects duplicate absolute and file-URL report aliases', async () => {
  const value = await fixture()
  try {
    const absolute = resolve(value.root, value.source)
    value.summary = {total: passingCounts, [absolute]: passingCounts, [pathToFileURL(absolute).href]: passingCounts}
    await assert.rejects(checkCoverage(value.scope, value.summary, value.root), /duplicate paths/)
  } finally {
    await value.dispose()
  }
})

test('rejects raw V8 coverage', async () => {
  const value = await fixture()
  try {
    await assert.rejects(checkCoverage(value.scope, {result: []}, value.root), /Raw V8 coverage/)
  } finally {
    await value.dispose()
  }
})

test('rejects a report without Istanbul metrics', async () => {
  const value = await fixture()
  try {
    await assert.rejects(checkCoverage(value.scope, {total: {}, [resolve(value.root, value.source)]: {}}, value.root))
  } finally {
    await value.dispose()
  }
})

for (const source of [
  '../outside.ts',
  'packages/example/dist/command.js',
  'test/helper.ts',
  'packages/example/src/*.ts',
]) {
  test(`rejects invalid scope ${source}`, async () => {
    const value = await fixture()
    try {
      await assert.rejects(
        checkCoverage({...value.scope, files: [source]}, value.summary, value.root),
        /Scope must name/,
      )
    } finally {
      await value.dispose()
    }
  })
}

test('rejects invalid thresholds', async () => {
  const value = await fixture()
  try {
    await assert.rejects(
      checkCoverage({...value.scope, thresholds: {...thresholds, lines: 101}}, value.summary, value.root),
      /from 0 to 100/,
    )
  } finally {
    await value.dispose()
  }
})

test('rejects an empty scope', async () => {
  const value = await fixture()
  try {
    await assert.rejects(checkCoverage({...value.scope, files: []}, value.summary, value.root), /nonempty files array/)
  } finally {
    await value.dispose()
  }
})

test('rejects repeated scope paths', async () => {
  const value = await fixture()
  try {
    await assert.rejects(
      checkCoverage({...value.scope, files: [value.source, value.source]}, value.summary, value.root),
      /duplicate source paths/,
    )
  } finally {
    await value.dispose()
  }
})

test('CLI exits 0 for a pass, 1 for a missed target, and 2 for raw coverage', async () => {
  const value = await fixture()
  try {
    const scopePath = join(value.root, 'scope.json')
    const summaryPath = join(value.root, 'summary.json')
    await writeFile(scopePath, JSON.stringify(value.scope))
    await writeFile(summaryPath, JSON.stringify(value.summary))
    assert.equal(spawnSync(process.execPath, [checker, scopePath, summaryPath, value.root]).status, 0)

    value.summary[resolve(value.root, value.source)] = {...passingCounts, lines: {total: 10, covered: 0}}
    await writeFile(summaryPath, JSON.stringify(value.summary))
    assert.equal(spawnSync(process.execPath, [checker, scopePath, summaryPath, value.root]).status, 1)

    await writeFile(summaryPath, JSON.stringify({result: []}))
    assert.equal(spawnSync(process.execPath, [checker, scopePath, summaryPath, value.root]).status, 2)

    const missing = spawnSync(process.execPath, [checker, scopePath, join(value.root, 'missing.json'), value.root], {
      encoding: 'utf8',
    })
    assert.equal(missing.status, 2)
    assert.match(missing.stderr, /Run `pnpm test:commands:coverage` to generate it/)
  } finally {
    await value.dispose()
  }
})

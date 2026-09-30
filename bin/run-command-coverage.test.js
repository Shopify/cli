/* eslint-disable n/no-unsupported-features/node-builtins */
import assert from 'node:assert/strict'
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {test} from 'node:test'

import {flattenCoverageFiles, parseArguments, resolveOutputDirectory} from './run-command-coverage.js'

test('uses the app-info coverage defaults', () => {
  assert.deepEqual(parseArguments([]), {
    scope: 'test/app-info/coverage-scope.json',
    testFile: 'app-info.test.ts',
    output: 'coverage/commands/app-info',
    testName: undefined,
    help: false,
  })
})

test('accepts explicit coverage options', () => {
  assert.deepEqual(
    parseArguments([
      '--scope',
      'test/example/coverage-scope.json',
      '--test-file',
      'example.test.ts',
      '--test-name',
      'focused case',
      '--output',
      'coverage/commands/example',
    ]),
    {
      scope: 'test/example/coverage-scope.json',
      testFile: 'example.test.ts',
      output: 'coverage/commands/example',
      testName: 'focused case',
      help: false,
    },
  )
})

test('rejects unknown options and missing values', () => {
  assert.throws(() => parseArguments(['--unknown']), /Unknown option/)
  assert.throws(() => parseArguments(['--scope']), /needs a value/)
})

test('confines generated artifacts to the coverage directory', () => {
  assert.match(resolveOutputDirectory('coverage/commands/example'), /coverage\/commands\/example$/)
  assert.throws(() => resolveOutputDirectory('/tmp/example-coverage'), /below coverage/)
  assert.throws(() => resolveOutputDirectory('coverage'), /below coverage/)
})

test('copies nested V8 reports and restores one external source map', async () => {
  const root = await mkdtemp(join(tmpdir(), 'command-coverage-test-'))
  try {
    const raw = join(root, 'raw')
    const output = join(root, 'flat')
    const bundle = join(root, 'dist/bundle.js')
    const source = join(root, 'src/source.ts')
    const bundleUrl = pathToFileURL(bundle).href
    await mkdir(join(raw, 'case-a', '0'), {recursive: true})
    await mkdir(join(raw, 'case-b', '0'), {recursive: true})
    await mkdir(join(root, 'dist'), {recursive: true})
    await writeFile(bundle, 'export const value = true\n//# sourceMappingURL=bundle.js.map\n')
    await writeFile(
      `${bundle}.map`,
      JSON.stringify({
        version: 3,
        sources: ['../src/source.ts'],
        sourcesContent: ['export const value = true\n'],
        names: [],
        mappings: 'AAAA',
      }),
    )
    await writeFile(join(raw, 'case-a', '0', 'coverage-1.json'), '{"result":[]}')
    await writeFile(join(raw, 'case-b', '0', 'coverage-2.json'), JSON.stringify({result: [{url: bundleUrl}]}))
    await writeFile(join(raw, 'case-b', '0', 'trace.jsonl'), '{}')

    assert.equal(await flattenCoverageFiles(raw, output), 2)
    assert.equal(await readFile(join(output, 'coverage-000000.json'), 'utf8'), '{"result":[]}')
    assert.equal(
      await readFile(join(output, 'coverage-000001.json'), 'utf8'),
      JSON.stringify({result: [{url: bundleUrl}]}),
    )
    const sourceMapCache = JSON.parse(await readFile(join(output, 'source-map-cache.json'), 'utf8'))
    assert.deepEqual(sourceMapCache['source-map-cache'][bundleUrl].data.sources, [pathToFileURL(source).href])
    assert.deepEqual(sourceMapCache['source-map-cache'][bundleUrl].lineLengths, [25, 34, 0])
  } finally {
    await rm(root, {recursive: true, force: true})
  }
})

test('rejects a raw directory without V8 reports', async () => {
  const root = await mkdtemp(join(tmpdir(), 'command-coverage-test-'))
  try {
    await assert.rejects(flattenCoverageFiles(root, join(root, 'flat')), /No V8 coverage files/)
  } finally {
    await rm(root, {recursive: true, force: true})
  }
})

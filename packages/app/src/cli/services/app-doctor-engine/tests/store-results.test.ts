import {inCanonicalTemporaryDirectory, makeFixtureDirectory, writeFixtureFile} from './context-test-helpers.js'
import {createStoreContext, keyOf, resultPath, resultsDirectory, storedResult} from './store-fixtures.js'
import {
  enumerateAppDoctorResults,
  enumerateStoredResults,
  readAppDoctorResults,
  replaceAppDoctorResults,
} from '../store/results.js'
import {serializeAppDoctorResult} from '../results/index.js'
import {resultLeaf} from '../store/codec.js'
import {describe, expect, test} from 'vitest'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {copyFile, mkdir, readFile, readdir, unlink, writeFile} from 'node:fs/promises'
import type {AppDoctorContext} from '../context/types.js'
import type {AppDoctorResultKey} from '../store/types.js'

const listResults = async (context: AppDoctorContext) => (await readdir(resultsDirectory(context))).sort()

describe('replaceAppDoctorResults', () => {
  test('throws for a non-array entries argument', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      await expect(replaceAppDoctorResults(context, 'static', {} as never)).rejects.toBeInstanceOf(TypeError)
    })
  })

  test('creates the store and publishes every entry', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const first = await storedResult(context)
      const second = await storedResult(context, {checkId: 'OPEN_REDIRECT'})

      const batch = await replaceAppDoctorResults(context, 'static', [first, second])

      expect(batch).toEqual({
        status: 'complete',
        receipts: [
          {index: 0, key: keyOf(first), status: 'created', warnings: []},
          {index: 1, key: keyOf(second), status: 'created', warnings: []},
        ],
      })
      await expect(readFile(resultPath(context, first), 'utf8')).resolves.toBe(serializeAppDoctorResult(first))
      await expect(readFile(resultPath(context, second), 'utf8')).resolves.toBe(serializeAppDoctorResult(second))
      await expect(listResults(context)).resolves.toHaveLength(2)
    })
  })

  test('lays files out as .shopify/app-doctor/v1/<config32>/results/<scope32>.<CHECK_ID>.<mode>.json', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const result = await storedResult(context)

      await replaceAppDoctorResults(context, 'static', [result])

      const relativeStore = context.storeDirectory.slice(context.storageAnchor.length + 1)
      expect(relativeStore).toBe(joinPath('.shopify', 'app-doctor', 'v1', context.configurationIdentity))
      expect(context.configurationIdentity).toMatch(/^[0-9a-f]{32}$/)
      const scope32 = result.scope_identity.slice('sha256:'.length, 'sha256:'.length + 32)
      await expect(listResults(context)).resolves.toEqual([`${scope32}.${result.check_id}.static.json`])
    })
  })

  test('rejects the whole batch when one entry is invalid and writes nothing', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const valid = await storedResult(context)

      const batch = await replaceAppDoctorResults(context, 'static', [valid, {mode: 'static', junk: true}, 'text'])

      expect(batch).toMatchObject({
        status: 'rejected',
        receipts: [],
        diagnostics: [
          {code: 'invalid', index: 1},
          {code: 'invalid', index: 2},
        ],
      })
      await expect(fileExists(context.storeDirectory)).resolves.toBe(false)
    })
  })

  test('rejects duplicate owner tuples', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const first = await storedResult(context)
      const again = await storedResult(context, {producedAt: '2026-09-17T12:00:00.000Z'})

      const batch = await replaceAppDoctorResults(context, 'static', [first, again])

      expect(batch).toMatchObject({status: 'rejected', diagnostics: [{code: 'duplicate-key', index: 1}]})
      await expect(fileExists(context.storeDirectory)).resolves.toBe(false)
    })
  })

  test('rejects entries whose mode differs from the writer mode', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const agent = await storedResult(context, {mode: 'agent'})

      const batch = await replaceAppDoctorResults(context, 'static', [agent])

      expect(batch).toMatchObject({status: 'rejected', diagnostics: [{code: 'mode-mismatch', index: 0}]})
      await expect(fileExists(context.storeDirectory)).resolves.toBe(false)
    })
  })

  test('rejects entries owned by another configuration', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root, 'repo')
      const other = await createStoreContext(root, 'other')
      const foreign = await storedResult(other)

      const batch = await replaceAppDoctorResults(context, 'static', [foreign])

      expect(batch).toMatchObject({status: 'rejected', diagnostics: [{code: 'misowned', index: 0}]})
      await expect(fileExists(context.storeDirectory)).resolves.toBe(false)
    })
  })

  test('rejects a store directory outside the storage anchor', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const result = await storedResult(context)
      const broken = {...context, storeDirectory: joinPath(root, 'elsewhere')}

      const batch = await replaceAppDoctorResults(broken, 'static', [result])

      expect(batch).toMatchObject({status: 'rejected', diagnostics: [{code: 'invalid-context'}]})
    })
  })

  test('stops at the first failed publication and leaves the rest unattempted', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const first = await storedResult(context)
      const second = await storedResult(context, {checkId: 'OPEN_REDIRECT'})
      const third = await storedResult(context, {checkId: 'SSRF_REQUEST_FORGERY'})
      const secondLeaf = resultPath(context, second).split('/').at(-1) ?? ''
      await writeFixtureFile(context.storeDirectory, `.publication/${secondLeaf}/lock`, 'foreign')

      const batch = await replaceAppDoctorResults(context, 'static', [first, second, third], {
        lockWaitMilliseconds: 20,
      })

      expect(batch).toMatchObject({
        status: 'partial',
        receipts: [
          {index: 0, key: keyOf(first), status: 'created'},
          {index: 1, key: keyOf(second), status: 'failed', diagnostics: [{code: 'locked'}]},
          {index: 2, key: keyOf(third), status: 'unattempted'},
        ],
      })
      await expect(listResults(context)).resolves.toEqual([resultPath(context, first).split('/').at(-1)])
    })
  })

  test('keeps other owners and the other mode byte-identical when replacing one result', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const staticResult = await storedResult(context)
      const agentResult = await storedResult(context, {mode: 'agent'})
      const otherCheck = await storedResult(context, {checkId: 'OPEN_REDIRECT'})
      await replaceAppDoctorResults(context, 'static', [staticResult, otherCheck])
      await replaceAppDoctorResults(context, 'agent', [agentResult])
      const agentBytes = await readFile(resultPath(context, agentResult))
      const otherBytes = await readFile(resultPath(context, otherCheck))

      const updated = await storedResult(context, {producedAt: '2026-09-17T12:00:00.000Z'})
      const batch = await replaceAppDoctorResults(context, 'static', [updated])

      expect(batch).toMatchObject({
        status: 'complete',
        receipts: [{index: 0, status: 'replaced', previous: {status: 'retained'}}],
      })
      await expect(readFile(resultPath(context, updated), 'utf8')).resolves.toBe(serializeAppDoctorResult(updated))
      expect((await readFile(resultPath(context, agentResult))).equals(agentBytes)).toBe(true)
      expect((await readFile(resultPath(context, otherCheck))).equals(otherBytes)).toBe(true)
      await expect(listResults(context)).resolves.toHaveLength(3)
      if (batch.status !== 'complete') throw new Error('expected complete')
      const receipt = batch.receipts[0]
      if (receipt?.status !== 'replaced' || !receipt.previous) throw new Error('expected retained previous')
      await expect(readFile(receipt.previous.path, 'utf8')).resolves.toBe(serializeAppDoctorResult(staticResult))
    })
  })

  test('reports unchanged when republishing identical bytes', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const result = await storedResult(context)
      await replaceAppDoctorResults(context, 'static', [result])

      await expect(replaceAppDoctorResults(context, 'static', [result])).resolves.toMatchObject({
        status: 'complete',
        receipts: [{status: 'unchanged'}],
      })
    })
  })

  test('refuses to overwrite a current file it cannot validate', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const result = await storedResult(context)
      await replaceAppDoctorResults(context, 'static', [result])
      await writeFile(resultPath(context, result), '{not json')

      const batch = await replaceAppDoctorResults(context, 'static', [result])

      expect(batch).toMatchObject({
        status: 'partial',
        receipts: [{status: 'failed', diagnostics: [{code: 'malformed'}]}],
      })
      await expect(readFile(resultPath(context, result), 'utf8')).resolves.toBe('{not json')
    })
  })
})

describe('readAppDoctorResults', () => {
  test('reports a missing store for every key', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const result = await storedResult(context)

      await expect(readAppDoctorResults(context, [keyOf(result)])).resolves.toEqual({
        store: 'missing',
        results: [],
        missing: [{key: keyOf(result), reason: 'store'}],
        diagnostics: [],
      })
    })
  })

  test('distinguishes stored results from missing files', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const stored = await storedResult(context)
      const absent = await storedResult(context, {checkId: 'OPEN_REDIRECT'})
      await replaceAppDoctorResults(context, 'static', [stored])

      await expect(readAppDoctorResults(context, [keyOf(stored), keyOf(absent)])).resolves.toEqual({
        store: 'present',
        results: [{key: keyOf(stored), result: stored}],
        missing: [{key: keyOf(absent), reason: 'file'}],
        diagnostics: [],
      })
    })
  })

  test('reports a malformed file as a diagnostic, not as absence', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const result = await storedResult(context)
      await replaceAppDoctorResults(context, 'static', [result])
      await writeFile(resultPath(context, result), Buffer.from([0xff, 0xfe]))

      await expect(readAppDoctorResults(context, [keyOf(result)])).resolves.toEqual({
        store: 'present',
        results: [],
        missing: [],
        diagnostics: [{code: 'malformed', path: resultPath(context, result), message: expect.any(String)}],
      })
    })
  })

  test('reports a structurally valid but inconsistent result as invalid', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const result = await storedResult(context)
      await replaceAppDoctorResults(context, 'static', [result])
      await writeFile(resultPath(context, result), JSON.stringify({...result, schema_version: 99}))

      await expect(readAppDoctorResults(context, [keyOf(result)])).resolves.toMatchObject({
        store: 'present',
        results: [],
        missing: [],
        diagnostics: [{code: 'invalid', path: resultPath(context, result)}],
      })
    })
  })

  test('reports a file copied from another configuration as misowned', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root, 'repo')
      const other = await createStoreContext(root, 'other')
      const foreign = await storedResult(other)
      await replaceAppDoctorResults(other, 'static', [foreign])
      await mkdir(resultsDirectory(context), {recursive: true})
      await copyFile(resultPath(other, foreign), resultPath(context, foreign))

      await expect(readAppDoctorResults(context, [keyOf(foreign)])).resolves.toMatchObject({
        store: 'present',
        results: [],
        missing: [],
        diagnostics: [{code: 'misowned', path: resultPath(context, foreign)}],
      })
    })
  })

  test('reports a file stored under the wrong name as a filename mismatch', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const result = await storedResult(context)
      const other = await storedResult(context, {checkId: 'OPEN_REDIRECT'})
      await replaceAppDoctorResults(context, 'static', [result])
      await copyFile(resultPath(context, result), resultPath(context, other))

      await expect(readAppDoctorResults(context, [keyOf(other)])).resolves.toMatchObject({
        diagnostics: [{code: 'filename-mismatch', path: resultPath(context, other)}],
      })
    })
  })

  test('reports an unusable store directory as unavailable', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const result = await storedResult(context)
      await mkdir(joinPath(context.storeDirectory, '..'), {recursive: true})
      await writeFile(context.storeDirectory, 'not a directory')

      await expect(readAppDoctorResults(context, [keyOf(result)])).resolves.toMatchObject({
        store: 'unavailable',
        results: [],
        missing: [],
        diagnostics: [{code: 'unsafe-path', path: context.storeDirectory}],
      })
    })
  })

  test('reports malformed keys as invalid input', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const read = await readAppDoctorResults(context, [{scopeIdentity: '', checkId: 'X', mode: 'static'}])
      expect(read).toMatchObject({diagnostics: [{code: 'invalid-input', index: 0}]})
    })
  })
})

describe('enumerateAppDoctorResults', () => {
  test('lists every valid stored result in leaf order and ignores protocol files', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const staticResult = await storedResult(context)
      const agentResult = await storedResult(context, {mode: 'agent'})
      const otherCheck = await storedResult(context, {checkId: 'OPEN_REDIRECT'})
      await replaceAppDoctorResults(context, 'static', [staticResult, otherCheck])
      await replaceAppDoctorResults(context, 'agent', [agentResult])
      // A second static publication leaves a retained `previous` in `.publication/`.
      await replaceAppDoctorResults(context, 'static', [
        await storedResult(context, {producedAt: '2026-09-17T12:00:00.000Z'}),
      ])
      const stagePath = joinPath(
        resultsDirectory(context),
        `.${resultPath(context, agentResult).split('/').at(-1)}.next`,
      )
      await writeFile(stagePath, 'in flight')

      const read = await enumerateAppDoctorResults(context)

      expect(read.store).toBe('present')
      expect(read.missing).toEqual([])
      expect(read.diagnostics).toEqual([])
      const byLeaf = (left: AppDoctorResultKey, right: AppDoctorResultKey) =>
        resultLeaf(left) < resultLeaf(right) ? -1 : 1
      expect(read.results.map(({key}) => key)).toEqual(
        [keyOf(staticResult), keyOf(agentResult), keyOf(otherCheck)].sort(byLeaf),
      )
      expect(
        read.results.find(({key}) => key.mode === 'static' && key.checkId === staticResult.check_id)?.result,
      ).toMatchObject({produced_at: '2026-09-17T12:00:00.000Z'})
    })
  })

  test('reports a missing store and a store without a results directory', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      await expect(enumerateAppDoctorResults(context)).resolves.toEqual({
        store: 'missing',
        results: [],
        missing: [],
        diagnostics: [],
      })
      await mkdir(context.storeDirectory, {recursive: true})
      await expect(enumerateAppDoctorResults(context)).resolves.toEqual({
        store: 'present',
        results: [],
        missing: [],
        diagnostics: [],
      })
    })
  })

  test('reports foreign entries, unreadable results and vanished files as diagnostics', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const result = await storedResult(context)
      const vanishing = await storedResult(context, {checkId: 'OPEN_REDIRECT'})
      await replaceAppDoctorResults(context, 'static', [result, vanishing])
      await writeFile(joinPath(resultsDirectory(context), 'notes.txt'), 'hello')
      await makeFixtureDirectory(resultsDirectory(context), 'nested')
      await writeFile(resultPath(context, result), '{broken')
      // Simulate the file disappearing between listing and reading by removing it right before its read.
      const stale = resultPath(context, vanishing)
      const listing = await enumerateStoredResults(context, {
        beforeRead: async (path) => {
          if (path === stale) await unlink(stale)
        },
      })

      expect(listing.store).toBe('present')
      expect(listing.results).toEqual([])
      expect(listing.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({code: 'malformed', path: resultPath(context, result)}),
          expect.objectContaining({code: 'enumeration', path: stale}),
          expect.objectContaining({code: 'enumeration', path: joinPath(resultsDirectory(context), 'notes.txt')}),
          expect.objectContaining({code: 'enumeration', path: joinPath(resultsDirectory(context), 'nested')}),
        ]),
      )
      expect(listing.diagnostics).toHaveLength(4)
    })
  })
})

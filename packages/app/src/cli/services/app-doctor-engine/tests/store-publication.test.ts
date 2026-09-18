import {inCanonicalTemporaryDirectory, writeFixtureFile} from './context-test-helpers.js'
import {createStoreContext} from './store-fixtures.js'
import {publishUnderGuard, resolvePublicationTarget} from '../store/publication.js'
import {describe, expect, test} from 'vitest'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {readFile, readdir, writeFile} from 'node:fs/promises'
import type {PublicationTarget, CurrentSnapshot, PublicationSeams} from '../store/publication.js'
import type {AppDoctorStoreOptions} from '../store/types.js'
import type {AppDoctorContext} from '../context/types.js'

const LEAF = 'document.json'
const bytes = (text: string) => Buffer.from(text, 'utf8')

const target = (context: AppDoctorContext): PublicationTarget =>
  resolvePublicationTarget(context, joinPath(context.storeDirectory, 'results'), LEAF)

const publish = (
  publication: PublicationTarget,
  content: string,
  options: AppDoctorStoreOptions = {},
  seams: PublicationSeams = {},
) => publishUnderGuard(publication, options, () => ({ok: true, bytes: bytes(content)}), seams)

const stateFiles = async (publication: PublicationTarget) => (await readdir(publication.stateDirectory)).sort()

describe('resolvePublicationTarget', () => {
  test('derives every path from the store directory and the leaf', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const publication = target(context)
      const results = joinPath(context.storeDirectory, 'results')
      expect(publication).toEqual({
        anchor: context.storageAnchor,
        directory: results,
        currentPath: joinPath(results, LEAF),
        stagePath: joinPath(results, `.${LEAF}.next`),
        stateDirectory: joinPath(context.storeDirectory, '.publication', LEAF),
        lockPath: joinPath(context.storeDirectory, '.publication', LEAF, 'lock'),
        previousPath: joinPath(context.storeDirectory, '.publication', LEAF, 'previous'),
        previousStagePath: joinPath(context.storeDirectory, '.publication', LEAF, 'previous.next'),
      })
    })
  })
})

describe('publishUnderGuard', () => {
  test('creates, then replaces retaining the exact prior bytes, then reports unchanged without rotating', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const publication = target(context)

      await expect(publish(publication, 'one\n')).resolves.toEqual({status: 'created', warnings: []})
      await expect(readFile(publication.currentPath, 'utf8')).resolves.toBe('one\n')
      await expect(stateFiles(publication)).resolves.toEqual([])

      await expect(publish(publication, 'two\n')).resolves.toEqual({
        status: 'replaced',
        previous: {status: 'retained', path: publication.previousPath},
        warnings: [],
      })
      await expect(readFile(publication.currentPath, 'utf8')).resolves.toBe('two\n')
      await expect(readFile(publication.previousPath, 'utf8')).resolves.toBe('one\n')

      await expect(publish(publication, 'two\n')).resolves.toEqual({status: 'unchanged', warnings: []})
      await expect(readFile(publication.previousPath, 'utf8')).resolves.toBe('one\n')
      await expect(stateFiles(publication)).resolves.toEqual(['previous'])
      await expect(readdir(publication.directory)).resolves.toEqual([LEAF])
    })
  })

  test('gives the prepare callback the current snapshot and honours its failure', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const publication = target(context)
      await publish(publication, 'one\n')

      const seen: CurrentSnapshot[] = []
      const receipt = await publishUnderGuard(publication, {}, (current) => {
        seen.push(current)
        return {ok: false, diagnostics: [{code: 'edit-conflict', path: publication.currentPath, message: 'nope'}]}
      })
      expect(receipt).toEqual({
        status: 'failed',
        diagnostics: [{code: 'edit-conflict', path: publication.currentPath, message: 'nope'}],
      })
      expect(seen).toHaveLength(1)
      expect(seen[0]?.bytes.toString('utf8')).toBe('one\n')
      await expect(readFile(publication.currentPath, 'utf8')).resolves.toBe('one\n')
      await expect(stateFiles(publication)).resolves.toEqual([])
    })
  })

  test('cleans a stale stage file left by a crashed publication and proceeds', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const publication = target(context)
      await publish(publication, 'one\n')
      await writeFile(publication.stagePath, 'half-written')

      await expect(publish(publication, 'two\n')).resolves.toMatchObject({status: 'replaced'})
      await expect(readFile(publication.currentPath, 'utf8')).resolves.toBe('two\n')
      await expect(readdir(publication.directory)).resolves.toEqual([LEAF])
    })
  })

  test('reports locked when a foreign guard exists, waits a bounded time, and never steals it', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const publication = target(context)
      await writeFixtureFile(publication.stateDirectory, 'lock', 'foreign-token')

      const started = Date.now()
      const receipt = await publish(publication, 'one\n', {lockWaitMilliseconds: 120})
      const elapsed = Date.now() - started

      expect(receipt).toMatchObject({status: 'failed', diagnostics: [{code: 'locked', path: publication.lockPath}]})
      expect(elapsed).toBeGreaterThanOrEqual(100)
      expect(elapsed).toBeLessThan(2000)
      await expect(readFile(publication.lockPath, 'utf8')).resolves.toBe('foreign-token')
      await expect(fileExists(publication.currentPath)).resolves.toBe(false)
      await expect(fileExists(publication.stagePath)).resolves.toBe(false)
    })
  })

  test('serialises two concurrent writers so the loser waits for the guard and replaces the winner', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const publication = target(context)

      const receipts = await Promise.all([publish(publication, 'a\n'), publish(publication, 'b\n')])

      expect(receipts.map((receipt) => receipt.status).sort()).toEqual(['created', 'replaced'])
      expect(receipts.every((receipt) => receipt.status === 'failed' || receipt.warnings.length === 0)).toBe(true)
      const current = await readFile(publication.currentPath, 'utf8')
      const previous = await readFile(publication.previousPath, 'utf8')
      expect(['a\n', 'b\n']).toContain(current)
      expect(previous).toBe(current === 'a\n' ? 'b\n' : 'a\n')
      await expect(readdir(publication.directory)).resolves.toEqual([LEAF])
      await expect(stateFiles(publication)).resolves.toEqual(['previous'])
    })
  })

  test('detects a non-cooperative change between staging and commit and leaves the current file alone', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const publication = target(context)
      await publish(publication, 'one\n')

      const receipt = await publish(
        publication,
        'two\n',
        {},
        {
          beforeCommit: async () => {
            await writeFile(publication.currentPath, 'intruder\n')
          },
        },
      )

      expect(receipt).toMatchObject({
        status: 'failed',
        diagnostics: [{code: 'non-cooperative-change', path: publication.currentPath}],
      })
      await expect(readFile(publication.currentPath, 'utf8')).resolves.toBe('intruder\n')
      await expect(readdir(publication.directory)).resolves.toEqual([LEAF])
      await expect(stateFiles(publication)).resolves.toEqual(['previous'])
    })
  })

  test('detects a current file appearing between staging and commit', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const publication = target(context)

      const receipt = await publish(
        publication,
        'one\n',
        {},
        {
          beforeCommit: async () => {
            await writeFile(publication.currentPath, 'intruder\n')
          },
        },
      )

      expect(receipt).toMatchObject({status: 'failed', diagnostics: [{code: 'non-cooperative-change'}]})
      await expect(readFile(publication.currentPath, 'utf8')).resolves.toBe('intruder\n')
      await expect(readdir(publication.directory)).resolves.toEqual([LEAF])
    })
  })

  test('releases only its own token and warns when the guard was replaced underneath it', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const publication = target(context)
      // Much longer than our own token: it must still read as a foreign guard, not as an oversized file.
      const foreignToken = 'someone-else-'.repeat(12)

      const receipt = await publish(
        publication,
        'one\n',
        {},
        {
          beforeCommit: async () => {
            await writeFile(publication.lockPath, foreignToken)
          },
        },
      )

      expect(receipt).toMatchObject({status: 'created', warnings: [{code: 'non-cooperative-change'}]})
      await expect(readFile(publication.lockPath, 'utf8')).resolves.toBe(foreignToken)
    })
  })

  test('removes its guard after a successful publication', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const publication = target(context)
      await publish(publication, 'one\n')
      await expect(fileExists(publication.lockPath)).resolves.toBe(false)
    })
  })
})

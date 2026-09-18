import {inCanonicalTemporaryDirectory} from './context-test-helpers.js'
import {createStoreContext, suppression} from './store-fixtures.js'
import {editAppDoctorSuppressions, readAppDoctorSuppressions} from '../store/suppressions.js'
import {canonicalJson} from '../trace/index.js'
import {describe, expect, test} from 'vitest'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {mkdir, readFile, writeFile} from 'node:fs/promises'
import type {AppDoctorContext} from '../context/types.js'
import type {AppDoctorSuppressionDocument} from '../store/types.js'

const documentPath = (context: AppDoctorContext) => joinPath(context.storeDirectory, 'suppressions.json')
const previousPath = (context: AppDoctorContext) =>
  joinPath(context.storeDirectory, '.publication', 'suppressions.json', 'previous')

const document = (context: AppDoctorContext, suppressions: AppDoctorSuppressionDocument['suppressions']) => ({
  schema_version: 1 as const,
  configuration_identity: context.configurationIdentity,
  suppressions,
})

const writeDocument = async (context: AppDoctorContext, value: unknown) => {
  await mkdir(context.storeDirectory, {recursive: true})
  await writeFile(documentPath(context), `${canonicalJson(value)}\n`)
}

describe('readAppDoctorSuppressions', () => {
  test('distinguishes a missing store, a missing file, and an empty document', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)

      await expect(readAppDoctorSuppressions(context)).resolves.toEqual({
        status: 'missing',
        reason: 'store',
        diagnostics: [],
      })
      await mkdir(context.storeDirectory, {recursive: true})
      await expect(readAppDoctorSuppressions(context)).resolves.toEqual({
        status: 'missing',
        reason: 'file',
        diagnostics: [],
      })
      await writeDocument(context, document(context, []))
      await expect(readAppDoctorSuppressions(context)).resolves.toEqual({
        status: 'ok',
        document: document(context, []),
        diagnostics: [],
      })
    })
  })

  test('reports malformed and invalid documents as errors', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      await mkdir(context.storeDirectory, {recursive: true})
      await writeFile(documentPath(context), '{"schema_version":')
      await expect(readAppDoctorSuppressions(context)).resolves.toMatchObject({
        status: 'error',
        diagnostics: [{code: 'malformed', path: documentPath(context)}],
      })

      await writeDocument(context, {...document(context, []), extra: true})
      await expect(readAppDoctorSuppressions(context)).resolves.toMatchObject({
        status: 'error',
        diagnostics: [{code: 'invalid'}],
      })

      await writeDocument(context, document(context, [suppression('a'), suppression('a')]))
      await expect(readAppDoctorSuppressions(context)).resolves.toMatchObject({
        status: 'error',
        diagnostics: [{code: 'invalid'}],
      })

      await writeDocument(context, document(context, [suppression('a', {finding_fingerprint: 'not-a-digest'})]))
      await expect(readAppDoctorSuppressions(context)).resolves.toMatchObject({
        status: 'error',
        diagnostics: [{code: 'invalid'}],
      })
    })
  })

  test('reports a document owned by another configuration as misowned', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root, 'repo')
      const other = await createStoreContext(root, 'other')
      await writeDocument(context, document(other, [suppression('a')]))

      await expect(readAppDoctorSuppressions(context)).resolves.toMatchObject({
        status: 'error',
        diagnostics: [{code: 'misowned', path: documentPath(context)}],
      })
    })
  })

  test('reports an invalid context', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const broken = {...context, storeDirectory: root}
      await expect(readAppDoctorSuppressions(broken)).resolves.toMatchObject({
        status: 'error',
        diagnostics: [{code: 'invalid-context'}],
      })
    })
  })
})

describe('editAppDoctorSuppressions', () => {
  test('throws for a non-array edits argument', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      await expect(editAppDoctorSuppressions(context, {} as never)).rejects.toBeInstanceOf(TypeError)
    })
  })

  test('rejects malformed edits before touching the store', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)

      const result = await editAppDoctorSuppressions(context, [
        {operation: 'add', value: suppression('a')},
        {operation: 'add', value: {...suppression('b'), justification: ''}},
        {operation: 'remove', id: 'c'} as never,
        // `undefined` is not representable in JSON, even under an optional field.
        {
          operation: 'add',
          value: suppression('d', {
            provenance: {source: 'human', created_at: '2026-09-16T12:00:00.000Z', actor: undefined},
          }),
        },
      ])

      expect(result).toMatchObject({
        status: 'rejected',
        diagnostics: [
          {code: 'invalid-input', index: 1},
          {code: 'invalid-input', index: 2},
          {code: 'invalid-input', index: 3},
        ],
      })
      await expect(fileExists(context.storeDirectory)).resolves.toBe(false)
    })
  })

  test('creates the document from an add on a missing file', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)

      const result = await editAppDoctorSuppressions(context, [{operation: 'add', value: suppression('a')}])

      expect(result).toEqual({status: 'created', warnings: []})
      await expect(readFile(documentPath(context), 'utf8')).resolves.toBe(
        `${canonicalJson(document(context, [suppression('a')]))}\n`,
      )
      await expect(readAppDoctorSuppressions(context)).resolves.toMatchObject({
        status: 'ok',
        document: document(context, [suppression('a')]),
      })
    })
  })

  test('applies add, replace, and remove in order while retaining unrelated entries and the previous document', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      await editAppDoctorSuppressions(context, [
        {operation: 'add', value: suppression('a')},
        {operation: 'add', value: suppression('b')},
        {operation: 'add', value: suppression('c')},
      ])
      const before = await readFile(documentPath(context), 'utf8')

      const replacement = suppression('b', {justification: 'Re-reviewed.'})
      const result = await editAppDoctorSuppressions(context, [
        {operation: 'replace', id: 'b', expected: suppression('b'), value: replacement},
        {operation: 'remove', id: 'c', expected: suppression('c')},
        {operation: 'add', value: suppression('d')},
      ])

      expect(result).toEqual({
        status: 'replaced',
        previous: {status: 'retained', path: previousPath(context)},
        warnings: [],
      })
      await expect(readAppDoctorSuppressions(context)).resolves.toMatchObject({
        status: 'ok',
        document: document(context, [suppression('a'), replacement, suppression('d')]),
      })
      await expect(readFile(previousPath(context), 'utf8')).resolves.toBe(before)
    })
  })

  test('reports unchanged when the edits produce an identical document', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      await editAppDoctorSuppressions(context, [{operation: 'add', value: suppression('a')}])

      await expect(
        editAppDoctorSuppressions(context, [
          {operation: 'replace', id: 'a', expected: suppression('a'), value: suppression('a')},
        ]),
      ).resolves.toEqual({status: 'unchanged', warnings: []})
      await expect(editAppDoctorSuppressions(context, [])).resolves.toEqual({status: 'unchanged', warnings: []})
    })
  })

  test('treats an empty edit list as a no-op that creates neither the store nor a document', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)

      await expect(editAppDoctorSuppressions(context, [])).resolves.toEqual({status: 'unchanged', warnings: []})

      await expect(fileExists(documentPath(context))).resolves.toBe(false)
      await expect(fileExists(joinPath(context.storeDirectory, '.publication', 'suppressions.json'))).resolves.toBe(
        false,
      )
      await expect(fileExists(context.storeDirectory)).resolves.toBe(false)
      // A missing file stays distinct from an empty document.
      await expect(readAppDoctorSuppressions(context)).resolves.toEqual({
        status: 'missing',
        reason: 'store',
        diagnostics: [],
      })
    })
  })

  test('reports edit conflicts and leaves the document untouched', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      await editAppDoctorSuppressions(context, [{operation: 'add', value: suppression('a')}])
      const before = await readFile(documentPath(context), 'utf8')
      const path = documentPath(context)

      await expect(
        editAppDoctorSuppressions(context, [{operation: 'add', value: suppression('a')}]),
      ).resolves.toMatchObject({status: 'failed', diagnostics: [{code: 'edit-conflict', index: 0, path}]})
      await expect(
        editAppDoctorSuppressions(context, [{operation: 'remove', id: 'zzz', expected: suppression('zzz')}]),
      ).resolves.toMatchObject({status: 'failed', diagnostics: [{code: 'edit-conflict', index: 0}]})
      await expect(
        editAppDoctorSuppressions(context, [
          {operation: 'remove', id: 'a', expected: suppression('a', {justification: 'stale view'})},
        ]),
      ).resolves.toMatchObject({status: 'failed', diagnostics: [{code: 'edit-conflict', index: 0}]})
      // Replacing under one id with a value carrying another id is a shape error, not a conflict.
      await expect(
        editAppDoctorSuppressions(context, [
          {operation: 'replace', id: 'a', expected: suppression('a'), value: suppression('x')},
        ]),
      ).resolves.toMatchObject({status: 'rejected', diagnostics: [{code: 'invalid-input', index: 0}]})
      // The first edit is fine on its own; the second collides with it.
      await expect(
        editAppDoctorSuppressions(context, [
          {operation: 'add', value: suppression('b')},
          {operation: 'add', value: suppression('c', {finding_fingerprint: suppression('b').finding_fingerprint})},
        ]),
      ).resolves.toMatchObject({status: 'failed', diagnostics: [{code: 'edit-conflict', index: 1}]})

      await expect(readFile(documentPath(context), 'utf8')).resolves.toBe(before)
      await expect(fileExists(previousPath(context))).resolves.toBe(false)
    })
  })

  test('refuses to edit a document it cannot validate or does not own', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root, 'repo')
      const other = await createStoreContext(root, 'other')
      await writeDocument(context, document(other, []))

      await expect(
        editAppDoctorSuppressions(context, [{operation: 'add', value: suppression('a')}]),
      ).resolves.toMatchObject({status: 'failed', diagnostics: [{code: 'misowned'}]})

      await writeFile(documentPath(context), 'nonsense')
      await expect(
        editAppDoctorSuppressions(context, [{operation: 'add', value: suppression('a')}]),
      ).resolves.toMatchObject({status: 'failed', diagnostics: [{code: 'malformed'}]})
      await expect(readFile(documentPath(context), 'utf8')).resolves.toBe('nonsense')
    })
  })

  test('reports locked when a foreign guard exists', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = await createStoreContext(root)
      const lockDirectory = joinPath(context.storeDirectory, '.publication', 'suppressions.json')
      await mkdir(lockDirectory, {recursive: true})
      await writeFile(joinPath(lockDirectory, 'lock'), 'foreign')

      await expect(
        editAppDoctorSuppressions(context, [{operation: 'add', value: suppression('a')}], {lockWaitMilliseconds: 20}),
      ).resolves.toMatchObject({status: 'failed', diagnostics: [{code: 'locked'}]})
      await expect(fileExists(documentPath(context))).resolves.toBe(false)
    })
  })
})

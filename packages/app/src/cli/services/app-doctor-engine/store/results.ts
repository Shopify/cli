/**
 * Complete-result store: read, enumerate, and replace stored results for the
 * configuration a context describes.
 *
 * Reads never repair or guess: a file that decodes, parses, and proves it
 * belongs under its own name is a result; anything else is a diagnostic and
 * never mistaken for absence. Writes prevalidate the whole batch before a
 * single byte or directory is created.
 */
import {
  MAX_STORE_FILE_BYTES,
  checkResultOwnership,
  decodeStoreJson,
  encodeStoreText,
  isStageLeaf,
  isStorableResultKey,
  ownerKey,
  parseResultLeaf,
  resultLeaf,
} from './codec.js'
import {listStoreDirectory, readStoreFile} from './files.js'
import {publishUnderGuard, resolvePublicationTarget} from './publication.js'
import {inspectStore, resultsDirectoryOf, validateStoreContext} from './root.js'
import {parseAppDoctorResult, serializeAppDoctorResult} from '../results/index.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import type {CurrentSnapshot, PreparedPublication, PublicationSeams} from './publication.js'
import type {
  AppDoctorResultBatch,
  AppDoctorResultKey,
  AppDoctorResultRead,
  AppDoctorResultReceipt,
  AppDoctorStoreDiagnostic,
  AppDoctorStoreOptions,
  AppDoctorWriterMode,
} from './types.js'
import type {AppDoctorContext} from '../context/types.js'
import type {AppDoctorResult} from '../results/index.js'

const WRITER_MODES: ReadonlyArray<AppDoctorWriterMode> = ['static', 'agent']

const isWriterMode = (value: unknown): value is AppDoctorWriterMode => WRITER_MODES.some((mode) => mode === value)

type DecodedResult = {ok: true; result: AppDoctorResult} | {ok: false; diagnostic: AppDoctorStoreDiagnostic}

/** Bytes → JSON → validated result → ownership proven against the context and the filename. */
function decodeStoredResult(context: AppDoctorContext, leaf: string, path: string, bytes: Buffer): DecodedResult {
  const decoded = decodeStoreJson(bytes)
  if (!decoded.ok) return {ok: false, diagnostic: {code: decoded.code, path, message: decoded.message}}
  const parsed = parseAppDoctorResult(decoded.value)
  if (!parsed.ok) {
    return {ok: false, diagnostic: {code: 'invalid', path, message: `Stored result is invalid: ${parsed.errors[0]}`}}
  }
  const violation = checkResultOwnership(context.configurationIdentity, leaf, parsed.result)
  if (violation === 'misowned') {
    return {ok: false, diagnostic: {code: violation, path, message: 'Stored result belongs to another configuration.'}}
  }
  if (violation === 'filename-mismatch') {
    return {ok: false, diagnostic: {code: violation, path, message: 'Stored result does not match its filename.'}}
  }
  return {ok: true, result: parsed.result}
}

type StoredResultRead =
  | {status: 'present'; result: AppDoctorResult}
  | {status: 'absent'}
  | {status: 'error'; diagnostic: AppDoctorStoreDiagnostic}

async function readStoredResult(context: AppDoctorContext, leaf: string): Promise<StoredResultRead> {
  const path = joinPath(resultsDirectoryOf(context), leaf)
  const read = await readStoreFile(context.storageAnchor, path, MAX_STORE_FILE_BYTES)
  if (read.status !== 'present') return read
  const decoded = decodeStoredResult(context, leaf, path, read.bytes)
  return decoded.ok ? {status: 'present', result: decoded.result} : {status: 'error', diagnostic: decoded.diagnostic}
}

/** A key must have the shape the filename grammar can represent, or it names nothing. */
const isResultKey = (value: unknown): value is AppDoctorResultKey => {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.scopeIdentity === 'string' &&
    typeof candidate.checkId === 'string' &&
    isWriterMode(candidate.mode) &&
    isStorableResultKey({scopeIdentity: candidate.scopeIdentity, checkId: candidate.checkId, mode: candidate.mode})
  )
}

const unavailableRead = (diagnostic: AppDoctorStoreDiagnostic): AppDoctorResultRead => ({
  store: 'unavailable',
  results: [],
  missing: [],
  diagnostics: [diagnostic],
})

/** Read the results for specific owner keys. Throws only when `keys` is not an array. */
export async function readAppDoctorResults(
  context: AppDoctorContext,
  keys: ReadonlyArray<AppDoctorResultKey>,
): Promise<AppDoctorResultRead> {
  if (!Array.isArray(keys)) throw new TypeError('readAppDoctorResults expects an array of keys')
  const contextViolation = validateStoreContext(context)
  if (contextViolation) return unavailableRead(contextViolation)

  const diagnostics: AppDoctorStoreDiagnostic[] = []
  const validKeys: AppDoctorResultKey[] = []
  keys.forEach((key, index) => {
    if (isResultKey(key)) validKeys.push(key)
    else diagnostics.push({code: 'invalid-input', path: resultsDirectoryOf(context), index, message: 'Malformed key.'})
  })

  const store = await inspectStore(context)
  if (store.status === 'unavailable') return unavailableRead(store.diagnostic)
  if (store.status === 'missing') {
    return {store: 'missing', results: [], missing: validKeys.map((key) => ({key, reason: 'store'})), diagnostics}
  }

  const reads = await Promise.all(validKeys.map((key) => readStoredResult(context, resultLeaf(key))))
  const results: AppDoctorResultRead['results'] = []
  const missing: AppDoctorResultRead['missing'] = []
  reads.forEach((read, index) => {
    const key = validKeys[index]
    if (key === undefined) return
    if (read.status === 'present') results.push({key, result: read.result})
    else if (read.status === 'absent') missing.push({key, reason: 'file'})
    else diagnostics.push(read.diagnostic)
  })
  return {store: 'present', results, missing, diagnostics}
}

const enumerationDiagnostic = (path: string, message: string): AppDoctorStoreDiagnostic => ({
  code: 'enumeration',
  path,
  message,
})

/**
 * Read every current result file in the store. Stage files are protocol
 * artefacts and are skipped silently; anything else that is not a current file
 * is reported. The `.publication/` state lives outside `results/` and is never visited.
 */
export async function enumerateAppDoctorResults(context: AppDoctorContext): Promise<AppDoctorResultRead> {
  return enumerateStoredResults(context, {})
}

/** `enumerateAppDoctorResults` with test seams; not part of the public surface. */
export async function enumerateStoredResults(
  context: AppDoctorContext,
  seams: PublicationSeams,
): Promise<AppDoctorResultRead> {
  const contextViolation = validateStoreContext(context)
  if (contextViolation) return unavailableRead(contextViolation)
  const store = await inspectStore(context)
  if (store.status === 'unavailable') return unavailableRead(store.diagnostic)
  if (store.status === 'missing') return {store: 'missing', results: [], missing: [], diagnostics: []}

  const directory = resultsDirectoryOf(context)
  const listing = await listStoreDirectory(context.storageAnchor, directory)
  if (listing.status === 'absent') return {store: 'present', results: [], missing: [], diagnostics: []}
  if (listing.status === 'error') return {store: 'present', results: [], missing: [], diagnostics: [listing.diagnostic]}

  const results: AppDoctorResultRead['results'] = []
  const diagnostics: AppDoctorStoreDiagnostic[] = []
  for (const entry of listing.entries) {
    const path = joinPath(directory, entry.name)
    if (entry.kind !== 'file') {
      diagnostics.push(enumerationDiagnostic(path, 'Entry is not a regular file.'))
      continue
    }
    if (isStageLeaf(entry.name)) continue
    if (parseResultLeaf(entry.name) === undefined) {
      diagnostics.push(enumerationDiagnostic(path, 'Entry is not a result file.'))
      continue
    }
    // eslint-disable-next-line no-await-in-loop -- results are read in listing order so output is deterministic
    if (seams.beforeRead) await seams.beforeRead(path)
    // eslint-disable-next-line no-await-in-loop -- results are read in listing order so output is deterministic
    const read = await readStoredResult(context, entry.name)
    if (read.status === 'present') results.push({key: ownerKey(read.result), result: read.result})
    else if (read.status === 'absent')
      diagnostics.push(enumerationDiagnostic(path, 'File vanished during enumeration.'))
    else diagnostics.push(read.diagnostic)
  }
  return {store: 'present', results, missing: [], diagnostics}
}

interface PreparedEntry {
  readonly index: number
  readonly key: AppDoctorResultKey
  readonly leaf: string
  readonly bytes: Buffer
}

type Prevalidation = {ok: true; entries: PreparedEntry[]} | {ok: false; diagnostics: AppDoctorStoreDiagnostic[]}

/** Validate, own, dedupe, serialise, and size-check every entry before anything touches disk. */
function prevalidateEntries(
  context: AppDoctorContext,
  writerMode: AppDoctorWriterMode,
  entries: ReadonlyArray<unknown>,
): Prevalidation {
  const directory = resultsDirectoryOf(context)
  const diagnostics: AppDoctorStoreDiagnostic[] = []
  const prepared: PreparedEntry[] = []
  const seenLeaves = new Set<string>()

  entries.forEach((entry, index) => {
    const parsed = parseAppDoctorResult(entry)
    if (!parsed.ok) {
      diagnostics.push({code: 'invalid', path: directory, index, message: `Entry is invalid: ${parsed.errors[0]}`})
      return
    }
    const {result} = parsed
    const key = ownerKey(result)
    const leaf = resultLeaf(key)
    const path = joinPath(directory, leaf)
    if (result.mode !== writerMode) {
      diagnostics.push({code: 'mode-mismatch', path, index, message: `Entry mode is not ${writerMode}.`})
      return
    }
    if (result.configuration_identity !== context.configurationIdentity) {
      diagnostics.push({code: 'misowned', path, index, message: 'Entry belongs to another configuration.'})
      return
    }
    if (seenLeaves.has(leaf)) {
      diagnostics.push({code: 'duplicate-key', path, index, message: 'Entry repeats an earlier owner tuple.'})
      return
    }
    seenLeaves.add(leaf)
    const encoded = encodeStoreText(serializeAppDoctorResult(result))
    if (!encoded.ok) {
      diagnostics.push({code: encoded.code, path, index, message: encoded.message})
      return
    }
    prepared.push({index, key, leaf, bytes: encoded.bytes})
  })

  return diagnostics.length === 0 ? {ok: true, entries: prepared} : {ok: false, diagnostics}
}

/** The current file, if any, must itself be a valid result we own before it may be replaced. */
const guardedReplacement =
  (context: AppDoctorContext, entry: PreparedEntry, path: string) =>
  (current: CurrentSnapshot): PreparedPublication => {
    if (current === undefined) return {ok: true, bytes: entry.bytes}
    const decoded = decodeStoredResult(context, entry.leaf, path, current.bytes)
    return decoded.ok ? {ok: true, bytes: entry.bytes} : {ok: false, diagnostics: [decoded.diagnostic]}
  }

/**
 * Publish a batch of complete results for one writer mode. The batch is
 * rejected as a whole when any entry fails prevalidation; otherwise entries are
 * published in order and the batch stops at the first failed publication.
 * Throws only when `entries` is not an array.
 */
export async function replaceAppDoctorResults(
  context: AppDoctorContext,
  writerMode: AppDoctorWriterMode,
  entries: ReadonlyArray<unknown>,
  options: AppDoctorStoreOptions = {},
): Promise<AppDoctorResultBatch> {
  return publishResultBatch(context, writerMode, entries, options, {})
}

/** `replaceAppDoctorResults` with test seams; not part of the public surface. */
export async function publishResultBatch(
  context: AppDoctorContext,
  writerMode: AppDoctorWriterMode,
  entries: ReadonlyArray<unknown>,
  options: AppDoctorStoreOptions,
  seams: PublicationSeams,
): Promise<AppDoctorResultBatch> {
  if (!Array.isArray(entries)) throw new TypeError('replaceAppDoctorResults expects an array of entries')
  const contextViolation = validateStoreContext(context)
  if (contextViolation) return {status: 'rejected', diagnostics: [contextViolation], receipts: []}
  if (!isWriterMode(writerMode)) {
    const path = resultsDirectoryOf(context)
    return {
      status: 'rejected',
      diagnostics: [{code: 'invalid-input', path, message: 'Unknown writer mode.'}],
      receipts: [],
    }
  }
  const prevalidation = prevalidateEntries(context, writerMode, entries)
  if (!prevalidation.ok) return {status: 'rejected', diagnostics: prevalidation.diagnostics, receipts: []}

  const directory = resultsDirectoryOf(context)
  const receipts: AppDoctorResultReceipt[] = []
  let halted = false
  for (const entry of prevalidation.entries) {
    if (halted) {
      receipts.push({index: entry.index, key: entry.key, status: 'unattempted'})
      continue
    }
    const target = resolvePublicationTarget(context, directory, entry.leaf)
    // eslint-disable-next-line no-await-in-loop -- publication order defines which writer wins
    const receipt = await publishUnderGuard(
      target,
      options,
      guardedReplacement(context, entry, target.currentPath),
      seams,
    )
    receipts.push({index: entry.index, key: entry.key, ...receipt})
    halted = receipt.status === 'failed'
  }
  return {status: halted ? 'partial' : 'complete', receipts}
}

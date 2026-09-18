/**
 * Pure naming and byte-level codec for the store: filenames from owner keys,
 * bounded UTF-8/JSON encoding, and envelope-to-filename consistency checks.
 * Nothing here touches the filesystem.
 */
import {CHECK_ID_PATTERN} from '../results/schema.js'
import {SHA256_DIGEST} from '../results/scope.js'
import type {AppDoctorResultKey, AppDoctorStoreErrorCode, AppDoctorWriterMode} from './types.js'
import type {AppDoctorResultOwner} from '../results/index.js'

/** Upper bound for any single store file, on read and on write. */
export const MAX_STORE_FILE_BYTES = 5_000_000

/** Only this many hex characters of the scope digest appear in a filename. */
const SCOPE_HEX_LENGTH = 32
const DIGEST_PREFIX = 'sha256:'
const RESULT_LEAF = /^([0-9a-f]{32})\.([A-Z][A-Z0-9_]{0,63})\.(static|agent)\.json$/
const STAGE_SUFFIX = '.next'

/** True when `key` can name a store file; the schema enforces the same grammars on envelopes. */
export const isStorableResultKey = (key: AppDoctorResultKey): boolean =>
  SHA256_DIGEST.test(key.scopeIdentity) && CHECK_ID_PATTERN.test(key.checkId)

/**
 * `<scope32>.<CHECK_ID>.<mode>.json` for one owner key: the first 32 hex
 * characters of the scope identity digest, the check id verbatim, and the
 * writer mode. Callers validate keys first; a malformed key is a programming
 * error, not a store outcome.
 */
export function resultLeaf(key: AppDoctorResultKey): string {
  if (!SHA256_DIGEST.test(key.scopeIdentity)) throw new Error('A result key needs a sha256 scope identity.')
  if (!CHECK_ID_PATTERN.test(key.checkId)) throw new Error('A result key needs a catalogue-shaped check id.')
  const scope = key.scopeIdentity.slice(DIGEST_PREFIX.length, DIGEST_PREFIX.length + SCOPE_HEX_LENGTH)
  return `${scope}.${key.checkId}.${key.mode}.json`
}

/** Name of the incoming stage file that sits next to a current file. */
export const stageLeaf = (leaf: string): string => `.${leaf}${STAGE_SUFFIX}`

/** True for the stage name of any current-file leaf. */
export const isStageLeaf = (name: string): boolean =>
  name.startsWith('.') && name.endsWith(STAGE_SUFFIX) && name.length > STAGE_SUFFIX.length + 1

export interface ParsedResultLeaf {
  /** Truncated (32 hex) scope identity digest. */
  readonly scopeDigest: string
  readonly checkId: string
  readonly mode: AppDoctorWriterMode
}

/** Decompose a current-file name; `undefined` for anything that is not one. */
export function parseResultLeaf(name: string): ParsedResultLeaf | undefined {
  const match = RESULT_LEAF.exec(name)
  if (!match) return undefined
  const [, scopeDigest, checkId, mode] = match
  if (scopeDigest === undefined || checkId === undefined || (mode !== 'static' && mode !== 'agent')) return undefined
  return {scopeDigest, checkId, mode}
}

export type EncodeOutcome = {ok: true; bytes: Buffer} | {ok: false; code: 'oversized'; message: string}

/** UTF-8 bytes of `text`, or `oversized` when they exceed the store limit. */
export function encodeStoreText(text: string): EncodeOutcome {
  const bytes = Buffer.from(text, 'utf8')
  if (bytes.byteLength > MAX_STORE_FILE_BYTES) {
    return {
      ok: false,
      code: 'oversized',
      message: `Content is ${bytes.byteLength} bytes; limit is ${MAX_STORE_FILE_BYTES}.`,
    }
  }
  return {ok: true, bytes}
}

export type DecodeOutcome = {ok: true; value: unknown} | {ok: false; code: 'malformed'; message: string}

/** Fatal UTF-8 decoding followed by JSON parsing. Messages never echo file content. */
export function decodeStoreJson(bytes: Buffer): DecodeOutcome {
  let text: string
  try {
    text = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes)
  } catch (error) {
    // A fatal decoder reports invalid sequences as a TypeError; anything else is unexpected.
    if (!(error instanceof TypeError)) throw error
    return {ok: false, code: 'malformed', message: 'File is not valid UTF-8.'}
  }
  try {
    return {ok: true, value: JSON.parse(text)}
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    return {ok: false, code: 'malformed', message: 'File is not valid JSON.'}
  }
}

export type OwnershipViolation = Extract<AppDoctorStoreErrorCode, 'misowned' | 'filename-mismatch'>

/**
 * A stored envelope must belong to the context's configuration and must live
 * under the filename its own owner tuple produces (truncated scope digest,
 * check id, and mode). Both are errors, never absence.
 */
export function checkResultOwnership(
  configurationIdentity: string,
  leaf: string,
  owner: AppDoctorResultOwner,
): OwnershipViolation | undefined {
  if (owner.configuration_identity !== configurationIdentity) return 'misowned'
  const expected = resultLeaf({scopeIdentity: owner.scope_identity, checkId: owner.check_id, mode: owner.mode})
  return expected === leaf ? undefined : 'filename-mismatch'
}

/** The owner key a stored envelope claims for itself. */
export const ownerKey = (owner: AppDoctorResultOwner): AppDoctorResultKey => ({
  scopeIdentity: owner.scope_identity,
  checkId: owner.check_id,
  mode: owner.mode,
})

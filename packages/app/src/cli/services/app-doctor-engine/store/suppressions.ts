/**
 * Suppression document store: one strict, canonical JSON document per
 * configuration, edited under the same stage/retain/publish protocol as
 * results. Edits are expressed as intents with expected prior values so a
 * stale view never silently overwrites a newer document.
 */
import {decodeStoreJson, encodeStoreText} from './codec.js'
import {readStoreFile} from './files.js'
import {publishUnderGuard, resolvePublicationTarget} from './publication.js'
import {inspectStore, validateStoreContext} from './root.js'
import {describeSchemaIssues} from '../results/error.js'
import {isBoundedJson} from '../results/json.js'
import {SHA256_DIGEST} from '../results/scope.js'
import {canonicalJson} from '../trace/index.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {zod} from '@shopify/cli-kit/node/schema'
import type {PreparedPublication} from './publication.js'
import type {
  AppDoctorStoreDiagnostic,
  AppDoctorStoreOptions,
  AppDoctorSuppressionDocument,
  AppDoctorSuppressionEdit,
  AppDoctorSuppressionEditResult,
  AppDoctorSuppressionRead,
} from './types.js'
import type {AppDoctorContext} from '../context/types.js'
import type {Suppression} from '../types.js'

const SUPPRESSIONS_FILE = 'suppressions.json'

const nonemptyText = zod.string().refine((value) => value.trim().length > 0, 'must not be blank')
const isoTimestamp = zod.string().refine((value) => Number.isFinite(Date.parse(value)), 'must be an ISO date')

/** Mirrors `Suppression` from `../types.ts`, strictly: unknown fields are rejected at every level. */
const SuppressionSchema = zod
  .object({
    id: nonemptyText,
    finding_fingerprint: zod.string().regex(SHA256_DIGEST, 'must be a sha256 digest'),
    justification: nonemptyText,
    provenance: zod
      .object({
        source: zod.enum(['human', 'policy', 'external']),
        actor: zod.string().optional(),
        created_at: isoTimestamp,
      })
      .strict(),
  })
  .strict()

const hasUniqueValues = (values: ReadonlyArray<string>) => new Set(values).size === values.length

const SuppressionDocumentSchema = zod
  .object({
    schema_version: zod.literal(1),
    configuration_identity: nonemptyText,
    suppressions: zod
      .array(SuppressionSchema)
      .refine((entries) => hasUniqueValues(entries.map((entry) => entry.id)), 'ids must be unique')
      .refine(
        (entries) => hasUniqueValues(entries.map((entry) => entry.finding_fingerprint)),
        'finding fingerprints must be unique',
      ),
  })
  .strict()

const SuppressionEditSchema = zod.discriminatedUnion('operation', [
  zod.object({operation: zod.literal('add'), value: SuppressionSchema}).strict(),
  zod
    .object({
      operation: zod.literal('replace'),
      id: nonemptyText,
      expected: SuppressionSchema,
      value: SuppressionSchema,
    })
    .strict(),
  zod.object({operation: zod.literal('remove'), id: nonemptyText, expected: SuppressionSchema}).strict(),
])

/** `replace` and `remove` address one id; the expected and replacement values must carry that same id. */
const editIdMismatch = (edit: AppDoctorSuppressionEdit): string | undefined => {
  if (edit.operation === 'add') return undefined
  if (edit.expected.id !== edit.id) return 'expected.id must equal id'
  if (edit.operation === 'replace' && edit.value.id !== edit.id) return 'value.id must equal id'
  return undefined
}

const documentPathOf = (context: AppDoctorContext) => joinPath(context.storeDirectory, SUPPRESSIONS_FILE)

const emptyDocument = (context: AppDoctorContext): AppDoctorSuppressionDocument => ({
  schema_version: 1,
  configuration_identity: context.configurationIdentity,
  suppressions: [],
})

const serializeDocument = (document: AppDoctorSuppressionDocument): string => `${canonicalJson(document)}\n`

type DecodedDocument =
  | {ok: true; document: AppDoctorSuppressionDocument}
  | {ok: false; diagnostic: AppDoctorStoreDiagnostic}

/** Bytes → JSON → strict document owned by the context's configuration. */
function decodeDocument(context: AppDoctorContext, path: string, bytes: Buffer): DecodedDocument {
  const decoded = decodeStoreJson(bytes)
  if (!decoded.ok) return {ok: false, diagnostic: {code: decoded.code, path, message: decoded.message}}
  const parsed = SuppressionDocumentSchema.safeParse(decoded.value)
  if (!parsed.success) {
    const [issue] = describeSchemaIssues(parsed.error.issues)
    return {ok: false, diagnostic: {code: 'invalid', path, message: `Suppression document is invalid: ${issue}`}}
  }
  if (parsed.data.configuration_identity !== context.configurationIdentity) {
    return {
      ok: false,
      diagnostic: {code: 'misowned', path, message: 'Suppression document belongs to another configuration.'},
    }
  }
  return {ok: true, document: parsed.data}
}

/** Read the configuration's suppression document. A missing file is not an empty document. */
export async function readAppDoctorSuppressions(context: AppDoctorContext): Promise<AppDoctorSuppressionRead> {
  const contextViolation = validateStoreContext(context)
  if (contextViolation) return {status: 'error', diagnostics: [contextViolation]}
  const store = await inspectStore(context)
  if (store.status === 'unavailable') return {status: 'error', diagnostics: [store.diagnostic]}
  if (store.status === 'missing') return {status: 'missing', reason: 'store', diagnostics: []}

  const path = documentPathOf(context)
  const read = await readStoreFile(context.storageAnchor, path)
  if (read.status === 'absent') return {status: 'missing', reason: 'file', diagnostics: []}
  if (read.status === 'error') return {status: 'error', diagnostics: [read.diagnostic]}
  const decoded = decodeDocument(context, path, read.bytes)
  if (!decoded.ok) return {status: 'error', diagnostics: [decoded.diagnostic]}
  return {status: 'ok', document: decoded.document, diagnostics: []}
}

const sameSuppression = (left: Suppression, right: Suppression) => canonicalJson(left) === canonicalJson(right)

type EditApplication = {ok: true; suppressions: Suppression[]} | {ok: false; diagnostic: AppDoctorStoreDiagnostic}

const conflict = (path: string, index: number, message: string): EditApplication => ({
  ok: false,
  diagnostic: {code: 'edit-conflict', path, index, message},
})

/** Apply one edit to the evolving list; every expectation is checked against the live entry. */
function applyEdit(
  path: string,
  suppressions: Suppression[],
  edit: AppDoctorSuppressionEdit,
  index: number,
): EditApplication {
  if (edit.operation === 'add') {
    if (suppressions.some((entry) => entry.id === edit.value.id)) {
      return conflict(path, index, 'A suppression with this id already exists.')
    }
    return {ok: true, suppressions: [...suppressions, edit.value]}
  }
  const position = suppressions.findIndex((entry) => entry.id === edit.id)
  const current = suppressions[position]
  if (current === undefined) return conflict(path, index, 'No suppression with this id exists.')
  if (!sameSuppression(current, edit.expected)) {
    return conflict(path, index, 'The stored suppression differs from the expected value.')
  }
  if (edit.operation === 'remove') return {ok: true, suppressions: suppressions.filter((_, at) => at !== position)}
  return {ok: true, suppressions: suppressions.map((entry, at) => (at === position ? edit.value : entry))}
}

/** Apply edits in order and re-validate the final document's uniqueness invariants. */
function applyEdits(
  path: string,
  document: AppDoctorSuppressionDocument,
  edits: ReadonlyArray<AppDoctorSuppressionEdit>,
) {
  let suppressions = document.suppressions
  for (const [index, edit] of edits.entries()) {
    const applied = applyEdit(path, suppressions, edit, index)
    if (!applied.ok) return applied
    if (!hasUniqueValues(applied.suppressions.map((entry) => entry.finding_fingerprint))) {
      return conflict(path, index, 'Another suppression already covers this finding fingerprint.')
    }
    suppressions = applied.suppressions
  }
  return {ok: true, suppressions} as const
}

/** Shape-check every edit against the strict schema; nothing here consults the store. */
function prevalidateEdits(path: string, edits: ReadonlyArray<unknown>): AppDoctorStoreDiagnostic[] {
  return edits.flatMap((edit, index) => {
    const issue = describeEditIssue(edit)
    if (issue === undefined) return []
    return [{code: 'invalid-input' as const, path, index, message: `Edit is invalid: ${issue}`}]
  })
}

/** Edits must be plain JSON data (no `undefined`, even under optional fields) of the expected shape. */
function describeEditIssue(edit: unknown): string | undefined {
  if (!isBoundedJson(edit)) return 'expected bounded plain JSON data'
  const parsed = SuppressionEditSchema.safeParse(edit)
  return parsed.success ? editIdMismatch(parsed.data) : describeSchemaIssues(parsed.error.issues)[0]
}

/**
 * Edit the configuration's suppression document under its guard. A missing
 * file starts from an empty document; the result is published only when every
 * edit's expectation holds against the live document. An empty edit list
 * touches nothing, so a missing file is not turned into an empty document.
 * Throws only when `edits` is not an array.
 */
export async function editAppDoctorSuppressions(
  context: AppDoctorContext,
  edits: ReadonlyArray<AppDoctorSuppressionEdit>,
  options: AppDoctorStoreOptions = {},
): Promise<AppDoctorSuppressionEditResult> {
  if (!Array.isArray(edits)) throw new TypeError('editAppDoctorSuppressions expects an array of edits')
  const contextViolation = validateStoreContext(context)
  if (contextViolation) return {status: 'rejected', diagnostics: [contextViolation]}
  const path = documentPathOf(context)
  const inputDiagnostics = prevalidateEdits(path, edits)
  if (inputDiagnostics.length > 0) return {status: 'rejected', diagnostics: inputDiagnostics}
  if (edits.length === 0) return {status: 'unchanged', warnings: []}

  const target = resolvePublicationTarget(context, context.storeDirectory, SUPPRESSIONS_FILE)
  return publishUnderGuard(target, options, (current): PreparedPublication => {
    const decoded =
      current === undefined
        ? {ok: true as const, document: emptyDocument(context)}
        : decodeDocument(context, path, current.bytes)
    if (!decoded.ok) return {ok: false, diagnostics: [decoded.diagnostic]}
    const applied = applyEdits(path, decoded.document, edits)
    if (!applied.ok) return {ok: false, diagnostics: [applied.diagnostic]}
    const encoded = encodeStoreText(serializeDocument({...decoded.document, suppressions: applied.suppressions}))
    if (!encoded.ok) return {ok: false, diagnostics: [{code: encoded.code, path, message: encoded.message}]}
    return {ok: true, bytes: encoded.bytes}
  })
}

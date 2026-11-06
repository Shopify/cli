import {
  APP_SECURITY_SUPPRESSIONS_FILE_NAME,
  appSecuritySuppressionsPath,
  readJsonArtifact,
  prepareAppSecuritySuppressionsFile,
} from './app-security-artifacts.js'
import {projectAppSecurityPath} from './app-security/result.js'
import {
  MAX_JUSTIFICATION_LENGTH,
  MAX_PATH_LENGTH,
  MAX_SNIPPET_LENGTH,
  matchSuppressionEntries,
  reportingSourcesByCheckId,
  type AgentFindingsDocument,
  type DeterministicFindingsDocument,
  type FindingsSource,
  type StoredFinding,
  type SuppressionKind,
} from './app-security-engine/index.js'
import {isMissingFilesystemEntry} from './app-security-engine/scanners/filesystem-errors.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileRealPath} from '@shopify/cli-kit/node/fs'
import {basename, joinPath, normalizePath} from '@shopify/cli-kit/node/path'
import {zod} from '@shopify/cli-kit/node/schema'
import lockfile from 'proper-lockfile'
import {isDeepStrictEqual} from 'node:util'
import type {AppSecuritySelection} from './app-security-selection.js'

const SUPPRESSIONS_SCHEMA_VERSION = 1

const FINDINGS_SOURCES = ['deterministic', 'agent'] as const satisfies ReadonlyArray<FindingsSource>
/** The kinds of an entry, which `--kind` takes with the same spelling. */
export const SUPPRESSION_KINDS = ['false-positive', 'accepted-risk'] as const

// The schema's messages quote no value from the file, which can hold code from the app.
const requiredString = () => zod.string({required_error: 'required', invalid_type_error: 'must be a string'})

const choice = <TValues extends Readonly<[string, ...string[]]>>(values: TValues) =>
  zod.enum(values, {
    errorMap: (_issue, context) => ({
      message: context.data === undefined ? `required (${values.join(' or ')})` : `must be ${values.join(' or ')}`,
    }),
  })

const nonBlankText = (maxLength: number) =>
  requiredString()
    .max(maxLength, `must be at most ${maxLength} characters`)
    .refine((text) => text.trim() !== '', 'must not be empty')

/**
 * Finding locations are normalized paths relative to the app directory, and the matching is exact, so an entry
 * whose path isn't in that form could never match. `..` can only lead: a scan directory can sit outside the app.
 */
function pathProblem(path: string): string | undefined {
  if (path === '') return 'must not be empty'
  if (path.length > MAX_PATH_LENGTH) return `must be at most ${MAX_PATH_LENGTH} characters`
  if (path.includes('\\')) return 'must use / as the separator'
  if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) return 'must be relative to the app directory'
  // Brackets stay allowed: React Router route files use them as escapes, as in app/routes/sitemap[.]xml.tsx.
  if (/[*?]/.test(path)) return "can't contain wildcards: name one file"
  const segments = path.split('/')
  const firstName = segments.findIndex((segment) => segment !== '..')
  const normalized =
    firstName !== -1 &&
    segments.slice(firstName).every((segment) => segment !== '' && segment !== '.' && segment !== '..')
  if (!normalized) return 'must name a file, without empty or "." segments, and with ".." only at the start'
  return undefined
}

/** An app configuration's file name, or a client ID: a single path component, as results keys are. */
const isConfigurationName = (name: string): boolean =>
  name !== '' && name !== '.' && name !== '..' && !/[\\/]/.test(name)

const suppressionSchema = zod.object(
  {
    source: choice(FINDINGS_SOURCES),
    check: requiredString().min(1, 'must not be empty'),
    kind: choice(SUPPRESSION_KINDS),
    path: requiredString().superRefine((path, context) => {
      const problem = pathProblem(path)
      if (problem) context.addIssue({code: zod.ZodIssueCode.custom, message: problem})
    }),
    // Without `code`, the entry covers every finding of the check in the file.
    code: nonBlankText(MAX_SNIPPET_LENGTH).optional(),
    reason: nonBlankText(MAX_JUSTIFICATION_LENGTH),
    configurations: zod
      .array(
        requiredString().refine(
          isConfigurationName,
          'must be an app configuration file name, such as shopify.app.toml, or a client ID',
        ),
        {required_error: 'required', invalid_type_error: 'must be an array'},
      )
      .min(1, 'must list at least one app configuration'),
  },
  {invalid_type_error: 'must be an object'},
)

/**
 * The Zod schema for schema_version 1 of shopify.app-security.json. Unknown keys are stripped, as in the results
 * files, so a later CLI can add optional fields that this one ignores. Whether `check` is a check ID that `source`
 * can report depends on the registry, so `parseSuppressionsFile` checks that separately.
 */
const suppressionsFileSchema = zod.object({
  schema_version: zod.literal(SUPPRESSIONS_SCHEMA_VERSION),
  suppressions: zod.array(suppressionSchema, {required_error: 'required', invalid_type_error: 'must be an array'}),
})

/** One entry of shopify.app-security.json: a finding that the team decided not to fix, with the reason. */
export type AppSecuritySuppression = zod.infer<typeof suppressionSchema>

type ParseSuppressionsFileResult = {ok: true; suppressions: AppSecuritySuppression[]} | {ok: false; errors: string[]}

/** One problem, with the index of the entry it belongs to, or -1 for the file as a whole. */
interface SuppressionsFileProblem {
  entryIndex: number
  message: string
}

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const isFindingsSource = (value: unknown): value is FindingsSource =>
  FINDINGS_SOURCES.some((source) => source === value)

function describeJsonType(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

/** Renders a Zod issue as `path: message`, such as `suppressions[2].reason: must not be empty`. */
function describeIssue(issue: zod.ZodIssue): SuppressionsFileProblem {
  const path = issue.path
    .map((segment, index) => {
      if (typeof segment === 'number') return `[${segment}]`
      return index === 0 ? String(segment) : `.${segment}`
    })
    .join('')
  const [field, entryIndex] = issue.path
  return {
    entryIndex: field === 'suppressions' && typeof entryIndex === 'number' ? entryIndex : -1,
    message: path === '' ? issue.message : `${path}: ${issue.message}`,
  }
}

/**
 * The problems with each entry's `check`: it must be a check ID in the registry, and the entry's `source` must be
 * able to report it. Only entries whose `check` is a non-empty string are checked; the schema reports the others.
 */
function checkIdProblems(entries: unknown): SuppressionsFileProblem[] {
  if (!Array.isArray(entries)) return []
  const reportingSources = reportingSourcesByCheckId()
  return entries.flatMap((entry: unknown, entryIndex): SuppressionsFileProblem[] => {
    if (!isJsonObject(entry) || typeof entry.check !== 'string' || entry.check === '') return []
    const label = `suppressions[${entryIndex}].check`
    const sources = reportingSources.get(entry.check)
    if (!sources) return [{entryIndex, message: `${label}: not a known check ID`}]
    if (!isFindingsSource(entry.source) || sources.has(entry.source)) return []
    const otherSources = [...sources].join(' or ')
    return [
      {
        entryIndex,
        message: `${label}: ${entry.source} checks don't report ${entry.check}. Use "source": "${otherSources}".`,
      },
    ]
  })
}

/** Validates the parsed JSON of a suppressions file. All or nothing: any problem rejects the whole file. */
function parseSuppressionsFile(value: unknown): ParseSuppressionsFileResult {
  if (!isJsonObject(value)) {
    return {ok: false, errors: [`expected a JSON object, received ${describeJsonType(value)}`]}
  }
  if (value.schema_version !== SUPPRESSIONS_SCHEMA_VERSION) {
    return {ok: false, errors: [`schema_version must be ${SUPPRESSIONS_SCHEMA_VERSION}`]}
  }

  const parsed = suppressionsFileSchema.safeParse(value)
  const problems = [
    ...(parsed.success ? [] : parsed.error.issues.map(describeIssue)),
    ...checkIdProblems(value.suppressions),
  ].sort((left, right) => left.entryIndex - right.entryIndex)
  if (!parsed.success || problems.length > 0) {
    return {ok: false, errors: problems.map((problem) => problem.message)}
  }
  return {ok: true, suppressions: parsed.data.suppressions}
}

/**
 * Aborts with one error that lists every problem under the file's path. `details` repeats the absolute path and the
 * problems for JSON output.
 */
function abortInvalidSuppressionsFile(path: string, errors: string[]): never {
  const error = new AbortError(
    `The app security suppressions could not be loaded because ${APP_SECURITY_SUPPRESSIONS_FILE_NAME} is invalid.`,
    null,
    [`Fix every error in ${APP_SECURITY_SUPPRESSIONS_FILE_NAME}, then run the command again.`],
    [{title: path, body: {list: {items: errors}}}],
  )
  error.code = 'suppressions-file-invalid'
  error.details = {path: projectAppSecurityPath(path), errors}
  throw error
}

/**
 * Reads `<app directory>/shopify.app-security.json`. A missing file means no suppressions. An invalid file (JSON
 * that doesn't parse, an unknown schema_version, or any invalid entry) aborts with one error that lists every
 * problem, so nothing in it applies. The entries keep the file's order, so an entry's index is its index in the file.
 */
export async function readAppSecuritySuppressions(appDirectory: string): Promise<AppSecuritySuppression[]> {
  const path = appSecuritySuppressionsPath(appDirectory)
  const file = await readJsonArtifact(path)
  if (file.status === 'missing') return []
  if (file.status === 'invalid') abortInvalidSuppressionsFile(path, file.errors)

  const parsed = parseSuppressionsFile(file.value)
  if (!parsed.ok) abortInvalidSuppressionsFile(path, parsed.errors)
  return parsed.suppressions
}

/**
 * The paths of the entries with `code` whose files no longer exist in the app directory, which a stale entry needs for
 * its likely new path. It only tests whether each file exists, and reads none.
 */
export async function missingSuppressionPaths(
  appDirectory: string,
  suppressions: AppSecuritySuppression[],
): Promise<string[]> {
  const paths = [...new Set(suppressions.filter((suppression) => suppression.code !== undefined).map(({path}) => path))]
  const missing = await Promise.all(
    paths.map(async (path) => {
      try {
        await fileRealPath(joinPath(appDirectory, path))
        return false
        // eslint-disable-next-line no-catch-all/no-catch-all -- Optional hints must not fail the report on inspection errors.
      } catch (error) {
        // An access error does not establish that the old file is gone.
        return isMissingFilesystemEntry(error)
      }
    }),
  )
  return paths.filter((_path, index) => missing[index])
}

/**
 * Parses `--kind` and `--reason`, which give the kind and reason of a new entry. A problem is worded as the file's
 * validation words it, after the flag's name, such as `--reason: must not be empty`.
 */
export function parseSuppressionFlags(flags: {
  kind: string | undefined
  reason: string | undefined
}): {ok: true; decision: SuppressionDecision} | {ok: false; errors: string[]} {
  const kind = choice(SUPPRESSION_KINDS).safeParse(flags.kind)
  const reason = nonBlankText(MAX_JUSTIFICATION_LENGTH).safeParse(flags.reason)
  if (kind.success && reason.success) return {ok: true, decision: {kind: kind.data, reason: reason.data}}
  return {
    ok: false,
    errors: [
      ...(kind.success ? [] : kind.error.issues.map((issue) => `--kind: ${issue.message}`)),
      ...(reason.success ? [] : reason.error.issues.map((issue) => `--reason: ${issue.message}`)),
    ],
  }
}

/**
 * What is wrong with the reason of a new entry, worded as the file's validation words it, such as `must not be empty`,
 * or undefined when the reason is valid.
 */
export function suppressionReasonProblem(reason: string): string | undefined {
  const parsed = nonBlankText(MAX_JUSTIFICATION_LENGTH).safeParse(reason)
  return parsed.success ? undefined : parsed.error.issues[0]?.message
}

/** The app configuration that an entry lists for the selection's results: the configuration's file name, or the client ID. */
export function suppressionConfiguration(selection: AppSecuritySelection): string {
  if (selection.kind === 'no-config') return selection.clientId
  return selection.clientIdOverride ?? basename(selection.appConfigFilePath)
}

/** The stored results that a new entry must match, with the run's results key and the configuration that names it. */
export interface SuppressionResults {
  deterministic: DeterministicFindingsDocument | null
  agent: AgentFindingsDocument | null
  resultsKey: string
  configuration: string
}

/** A stored finding to suppress. */
export interface SuppressionTarget {
  source: FindingsSource
  checkId: string
  /** The finding's index in the findings of its source's stored check. */
  findingIndex: number
  finding: StoredFinding
}

/** What a person or the agent decided about a finding. */
export interface SuppressionDecision {
  kind: SuppressionKind
  reason: string
}

/** A change to shopify.app-security.json: append an entry, or add the run's configuration to an existing entry. */
export type SuppressionChange =
  | {type: 'add'; entry: AppSecuritySuppression}
  | {type: 'add-configuration'; index: number; configuration: string}

/**
 * - `saved`: an entry of the file already suppresses the finding, so nothing changes.
 * - `change`: the change that suppresses the finding, and only that finding.
 * - `refused`: no automatic candidate selected the finding alone. `problem` says why, as the end of a sentence.
 *   `withoutCode` describes the broader entry that suppresses every finding of this source and check in the file.
 *   It does not establish whether a manual code selector can select the finding alone.
 *   `invalidFields` lists fields rejected by file validation. An entry written by hand with the same values would
 *   also be invalid.
 */
export type SuppressionPlan =
  | {status: 'saved'; entryIndex: number}
  | {status: 'change'; change: SuppressionChange}
  | {status: 'refused'; problem: string; withoutCode?: {findingCount: number}; invalidFields?: string[]}

/**
 * Lines before and after the flagged line that a candidate `code` covers, in the order the candidates widen: the line
 * alone, then more of the statement around it, up to the two lines on each side that the excerpt holds.
 */
const CODE_WINDOWS: [number, number][] = [
  [0, 0],
  [-1, 0],
  [0, 1],
  [-1, 1],
  [-2, 1],
  [-1, 2],
  [-2, 2],
]

/** A word of a code line that a `code` can name: an identifier, a property path, or a URL part. */
const CODE_WORD = /[\w$.:/@-]{3,}/g

/**
 * Plans how to save a suppression for one finding of the current results. The new entry names the finding's source,
 * check and path, the run's configuration, and `code` from the finding's redacted excerpt, never from a source file.
 * A finding without a line gets no `code`. The plan holds only an entry that the matching of `review` and `check`
 * applies to that finding and to no other one in the current results:
 * 1. An entry that already suppresses the finding under this configuration leaves the file as it is.
 * 2. An entry for another configuration that would suppress only this finding gets this configuration too.
 * 3. Otherwise a new entry gets the shortest `code` that names the finding alone: its flagged line, then wider parts
 *    of the statement, then a word of the line that the finding's message names (the matching keeps the finding whose
 *    code and message both hold the text).
 */
export function planSuppression(
  target: SuppressionTarget,
  decision: SuppressionDecision,
  results: SuppressionResults,
  entries: AppSecuritySuppression[],
): SuppressionPlan {
  const savedIndex = matchingEntryIndex(entries, target, results)
  if (savedIndex !== undefined) return {status: 'saved', entryIndex: savedIndex}

  const path = normalizePath(target.finding.location.file)
  // The keys in the order of the file's schema, which a new entry keeps.
  const entryWithCode = (code: string | undefined): AppSecuritySuppression => ({
    source: target.source,
    check: target.checkId,
    kind: decision.kind,
    path,
    ...(code === undefined ? {} : {code}),
    reason: decision.reason,
    configurations: [results.configuration],
  })
  const base = entryWithCode(undefined)
  const problems = entryProblems(base)
  if (problems.length > 0) {
    return {
      status: 'refused',
      problem: `its entry would be invalid: ${problems.map(({message}) => message).join('; ')}`,
      invalidFields: [...new Set(problems.map(({field}) => field))],
    }
  }

  const hasLine = target.finding.location.line !== undefined
  const reusableIndex = entries.findIndex(
    (entry) =>
      entry.source === base.source &&
      entry.check === base.check &&
      entry.path === path &&
      (entry.code !== undefined) === hasLine &&
      matchesOnly({...entry, configurations: base.configurations}, target, results),
  )
  if (reusableIndex !== -1) {
    return {
      status: 'change',
      change: {type: 'add-configuration', index: reusableIndex, configuration: results.configuration},
    }
  }

  // Report the scope of the broader option without assuming that the candidate search is exhaustive.
  const refusedPlan = (problem: string): SuppressionPlan => {
    const [withoutCode] = matchSuppressionEntries(
      {entries: [base], resultsKey: results.resultsKey},
      recordedCheckLookup(results),
    ).entries
    return {status: 'refused', problem, withoutCode: {findingCount: withoutCode?.matched_finding_count ?? 0}}
  }

  const codes = codeCandidates(target.finding)
  if (codes.length === 0) {
    return refusedPlan('the results hold no code for its line, so no automatic code selector is available')
  }
  const entry = codes.map(entryWithCode).find((candidate) => matchesOnly(candidate, target, results))
  if (entry) return {status: 'change', change: {type: 'add', entry}}
  return refusedPlan(
    hasLine
      ? `every automatic code candidate also names another finding of ${target.checkId} in ${path}`
      : `it has no line, so its entry would cover every finding of ${target.checkId} in ${path}, and there are several`,
  )
}

/** The `code` candidates in the order `planSuppression` tries them: `undefined` alone for a finding without a line. */
function codeCandidates(finding: StoredFinding): (string | undefined)[] {
  const {line} = finding.location
  if (line === undefined) return [undefined]
  const excerpt = finding.code_excerpt ?? []
  const flaggedLine = excerpt.find((excerptLine) => excerptLine.line === line)
  if (!flaggedLine) return []

  const windows = CODE_WINDOWS.map(([before, after]) =>
    excerpt
      .filter((excerptLine) => excerptLine.line >= line + before && excerptLine.line <= line + after)
      .map((excerptLine) => excerptLine.text.trim())
      .filter((text) => text !== '')
      .join(' '),
  )
  const wordsInMessage = (flaggedLine.text.match(CODE_WORD) ?? [])
    .filter((word) => finding.message.includes(word))
    .sort((left, right) => right.length - left.length)
  return [...new Set([...windows, ...wordsInMessage])].filter(
    (code) => code !== '' && code.length <= MAX_SNIPPET_LENGTH,
  )
}

function recordedCheckLookup(results: SuppressionResults) {
  return (source: FindingsSource, checkId: string) => results[source]?.checks.find((check) => check.id === checkId)
}

/** The index of the first entry that suppresses the target in the current results, if any. */
function matchingEntryIndex(
  entries: AppSecuritySuppression[],
  target: SuppressionTarget,
  results: SuppressionResults,
): number | undefined {
  const matches = matchSuppressionEntries({entries, resultsKey: results.resultsKey}, recordedCheckLookup(results))
  return matches.entryFor(target.source, target.checkId, target.findingIndex)?.index
}

/** Whether the entry matches the target, and no other finding, in the current results. */
function matchesOnly(entry: AppSecuritySuppression, target: SuppressionTarget, results: SuppressionResults): boolean {
  const matches = matchSuppressionEntries(
    {entries: [entry], resultsKey: results.resultsKey},
    recordedCheckLookup(results),
  )
  const [result] = matches.entries
  return (
    result?.status === 'matched' &&
    result.matched_finding_count === 1 &&
    matches.entryFor(target.source, target.checkId, target.findingIndex) !== undefined
  )
}

/**
 * The problems that the file's validation would report for this entry, without the `suppressions[n].` prefix, each with
 * the field it belongs to.
 */
function entryProblems(entry: AppSecuritySuppression): {field: string; message: string}[] {
  const parsed = suppressionSchema.safeParse(entry)
  return [
    ...(parsed.success
      ? []
      : parsed.error.issues.map((issue) => ({field: String(issue.path[0]), message: describeIssue(issue).message}))),
    ...checkIdProblems([entry]).map((problem) => ({
      field: 'check',
      message: problem.message.replace(/^suppressions\[0\]\./, ''),
    })),
  ]
}

/** An entry of shopify.app-security.json as `saveAppSecuritySuppressions` left it. */
export interface SavedSuppression {
  /** The entry's index in the file, from 0. */
  index: number
  /** `added` for a new entry, `configuration-added` for an existing entry that got the run's configuration. */
  change: 'added' | 'configuration-added'
  entry: AppSecuritySuppression
}

/**
 * Applies the changes to `<app directory>/shopify.app-security.json` in one atomic write, creating the file with
 * schema_version 1 when it doesn't exist. Refuses an invalid file with the error of `readAppSecuritySuppressions`, and
 * writes nothing. Checks the entries used to plan the changes and serializes CLI writers with a file lock.
 * Validates the final bytes before `beforeCommit`, then commits those same bytes. New entries go at the end. Every
 * other key, value and order stays as the file has them, in two-space
 * JSON with a trailing newline, so a file in that format changes only where an entry is added or extended.
 */
export async function saveAppSecuritySuppressions(
  appDirectory: string,
  changes: SuppressionChange[],
  expectedEntries: AppSecuritySuppression[],
  beforeCommit?: () => Promise<void>,
): Promise<{path: string; saved: SavedSuppression[]}> {
  const path = appSecuritySuppressionsPath(appDirectory)
  const release = await lockfile.lock(appDirectory, {lockfilePath: `${path}.lock`})
  try {
    const document = await readSuppressionDocument(appDirectory)
    const parsed = parseSuppressionsFile(document)
    if (!parsed.ok) abortInvalidSuppressionsFile(path, parsed.errors)
    if (!isDeepStrictEqual(parsed.suppressions, expectedEntries)) abortChangedSuppressions()

    const updated = copySuppressionDocument(document)
    const saved = changes.map((change): SavedSuppression => {
      if (change.type === 'add') {
        updated.suppressions.push(change.entry)
        return {index: updated.suppressions.length - 1, change: 'added', entry: change.entry}
      }
      const entry = updated.suppressions[change.index]
      if (!entry) abortChangedSuppressions()
      entry.configurations.push(change.configuration)
      return {index: change.index, change: 'configuration-added', entry: suppressionSchema.parse(entry)}
    })
    const validated = parseSuppressionsFile(updated)
    if (!validated.ok) abortInvalidSuppressionsFile(path, validated.errors)
    const commit = await prepareAppSecuritySuppressionsFile(appDirectory, updated)
    await beforeCommit?.()
    // The lock serializes CLI writers. Also refuse edits made by an editor while another artifact was written.
    if (!isDeepStrictEqual(await readSuppressionDocument(appDirectory), document)) abortChangedSuppressions()
    await commit()
    return {path, saved}
  } finally {
    await release()
  }
}

// Keep unknown fields at both levels when a newer CLI has added them to the committed file.
const rawSuppressionsFileSchema = suppressionsFileSchema
  .extend({suppressions: zod.array(suppressionSchema.passthrough())})
  .passthrough()

function copySuppressionDocument(value: unknown): zod.infer<typeof rawSuppressionsFileSchema> {
  rawSuppressionsFileSchema.parse(value)
  // Zod reorders known and unknown keys. Clone the validated input to retain the committed file's key order.
  return structuredClone(value) as zod.infer<typeof rawSuppressionsFileSchema>
}

async function readSuppressionDocument(appDirectory: string): Promise<unknown> {
  const path = appSecuritySuppressionsPath(appDirectory)
  const file = await readJsonArtifact(path)
  if (file.status === 'invalid') abortInvalidSuppressionsFile(path, file.errors)
  return file.status === 'missing' ? {schema_version: SUPPRESSIONS_SCHEMA_VERSION, suppressions: []} : file.value
}

function abortChangedSuppressions(): never {
  const error = new AbortError(
    'The app security suppressions changed before they could be saved.',
    'Run the command again to use the current suppressions file.',
  )
  error.code = 'suppressions-file-changed'
  throw error
}

import {
  APP_SECURITY_SUPPRESSIONS_FILE_NAME,
  appSecuritySuppressionsPath,
  readJsonArtifact,
} from './app-security-artifacts.js'
import {projectAppSecurityPath} from './app-security/result.js'
import {
  MAX_JUSTIFICATION_LENGTH,
  MAX_PATH_LENGTH,
  MAX_SNIPPET_LENGTH,
  reportingSourcesByCheckId,
  type FindingsSource,
} from './app-security-engine/index.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {zod} from '@shopify/cli-kit/node/schema'

const SUPPRESSIONS_SCHEMA_VERSION = 1

const FINDINGS_SOURCES = ['deterministic', 'agent'] as const satisfies ReadonlyArray<FindingsSource>
const SUPPRESSION_KINDS = ['false-positive', 'accepted-risk'] as const

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

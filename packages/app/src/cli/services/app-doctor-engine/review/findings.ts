/**
 * Agent findings document: what a coding agent writes for one review scope
 * after running the check prompts, and what `shopify app doctor record` reads.
 *
 * The document carries only what the agent knows. Identity fields the CLI
 * computes (`code`, `key`, `fingerprint`, `points`, `confidence`) are absent;
 * record derives them from the bound check and the result contract. Paths are
 * scope-relative POSIX paths, projected to evidence paths at record time.
 */
import {describeSchemaIssues} from '../results/error.js'
import {CHECK_ID_PATTERN} from '../results/schema.js'
import {zod} from '@shopify/cli-kit/node/schema'

export const APP_DOCTOR_AGENT_FINDINGS_SCHEMA_VERSION = 1 as const

const MAX_TEXT_LENGTH = 64_000
const MAX_PATH_LENGTH = 4096
// A leading drive letter would make the path absolute on Windows even without a slash.
const WINDOWS_DRIVE_PREFIX = /^[A-Za-z]:/

/** Plain `Error`: the engine is a library boundary and callers decide how to surface failures. */
export class AppDoctorAgentFindingsError extends Error {
  readonly details: ReadonlyArray<string>

  constructor(details: ReadonlyArray<string>) {
    super(`The App Doctor findings document is invalid: ${details.join('; ')}`)
    this.name = 'AppDoctorAgentFindingsError'
    this.details = details
  }
}

const text = zod.string().max(MAX_TEXT_LENGTH)
const nonemptyText = text.refine((value) => value.trim().length > 0, 'must not be blank')
const positiveInteger = zod.number().int().positive().safe()

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0
    return code < 0x20 || (code >= 0x7f && code <= 0x9f)
  })
}

/** Relative to the scope directory, `/`-separated, and unable to escape it lexically. */
export function isScopeRelativePosixPath(value: string): boolean {
  if (value.length === 0 || value.length > MAX_PATH_LENGTH) return false
  if (value.includes('\\') || value.startsWith('/') || WINDOWS_DRIVE_PREFIX.test(value)) return false
  if (hasControlCharacter(value)) return false
  return value.split('/').every((component) => component.length > 0 && component !== '.' && component !== '..')
}

const scopeRelativePath = zod
  .string()
  .max(MAX_PATH_LENGTH)
  .refine(isScopeRelativePosixPath, 'must be a scope-relative POSIX path without `.`, `..`, or backslashes')

const location = zod
  .object({file: scopeRelativePath, line: positiveInteger.optional(), column: positiveInteger.optional()})
  .strict()

/**
 * CLI-owned finding fields are deliberately absent: `fix.automated` is always
 * `false` for agent findings (record sets it), and `detection_evidence` is a
 * static-analysis-only field that agent findings never carry.
 */
export const AppDoctorAgentFindingInputSchema = zod
  .object({
    title: nonemptyText,
    message: nonemptyText,
    severity: zod.enum(['high', 'medium', 'low']),
    location,
    evidence: zod.array(zod.object({location, quote: text.optional()}).strict()),
    snippet: text.optional(),
    fix: zod.object({description: nonemptyText, guide: text.optional()}).strict(),
    agent_confidence: zod.enum(['high', 'medium', 'low']),
    agent_reasoning: nonemptyText,
  })
  .strict()

export const AppDoctorAgentCheckOutcomeSchema = zod.enum(['clean', 'findings', 'not_applicable', 'unresolved'])

const AppDoctorAgentCheckSchema = zod
  .object({
    check_id: zod.string().regex(CHECK_ID_PATTERN, 'must be an uppercase check id'),
    outcome: AppDoctorAgentCheckOutcomeSchema,
    inspected_files: zod.array(scopeRelativePath),
    reason: nonemptyText.optional(),
    guidance: nonemptyText.optional(),
    findings: zod.array(AppDoctorAgentFindingInputSchema),
  })
  .strict()
  .superRefine((check, context) => {
    const issue = (path: string, message: string) =>
      context.addIssue({code: zod.ZodIssueCode.custom, path: [path], message})
    if (check.outcome === 'findings' && check.findings.length === 0) {
      issue('findings', 'must not be empty when the outcome is `findings`')
    }
    if (check.outcome !== 'findings' && check.findings.length > 0) {
      issue('findings', 'must be empty unless the outcome is `findings`')
    }
    for (const field of ['reason', 'guidance'] as const) {
      if (check.outcome === 'unresolved' && check[field] === undefined) {
        issue(field, 'is required when the outcome is `unresolved`')
      }
      if (check.outcome !== 'unresolved' && check[field] !== undefined) {
        issue(field, 'is only allowed when the outcome is `unresolved`')
      }
    }
  })

export const AppDoctorAgentFindingsDocumentSchema = zod
  .object({
    schema_version: zod.literal(APP_DOCTOR_AGENT_FINDINGS_SCHEMA_VERSION),
    review: nonemptyText,
    checks: zod.array(AppDoctorAgentCheckSchema),
  })
  .strict()
  .superRefine((document, context) => {
    const seen = new Set<string>()
    document.checks.forEach((check, index) => {
      if (seen.has(check.check_id)) {
        context.addIssue({
          code: zod.ZodIssueCode.custom,
          path: ['checks', index, 'check_id'],
          message: 'must be unique within the document',
        })
      }
      seen.add(check.check_id)
    })
  })

export type AppDoctorAgentFindingInput = zod.infer<typeof AppDoctorAgentFindingInputSchema>
export type AppDoctorAgentCheckOutcome = zod.infer<typeof AppDoctorAgentCheckOutcomeSchema>
export type AppDoctorAgentCheck = zod.infer<typeof AppDoctorAgentCheckSchema>
export type AppDoctorAgentFindingsDocument = zod.infer<typeof AppDoctorAgentFindingsDocumentSchema>

/** Strictly validate an untrusted document. Error text names field paths but never echoes values. */
export function parseAppDoctorAgentFindingsDocument(value: unknown): AppDoctorAgentFindingsDocument {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppDoctorAgentFindingsError(['document: must be a JSON object'])
  }
  const parsed = AppDoctorAgentFindingsDocumentSchema.safeParse(value)
  if (!parsed.success) {
    // `describeSchemaIssues` labels an empty path `result`; this contract is a document.
    const details = describeSchemaIssues(parsed.error.issues).map((detail) =>
      detail.startsWith('result: ') ? `document: ${detail.slice('result: '.length)}` : detail,
    )
    throw new AppDoctorAgentFindingsError(details)
  }
  return parsed.data
}

const EXAMPLE_DOCUMENT: AppDoctorAgentFindingsDocument = {
  schema_version: APP_DOCTOR_AGENT_FINDINGS_SCHEMA_VERSION,
  review: '<the exact --review token from this scope\u2019s record command>',
  checks: [
    {
      check_id: 'REQUEST_DERIVED_SHOP_SCOPE',
      outcome: 'findings',
      inspected_files: ['app/routes/orders.tsx', 'app/shopify.server.ts'],
      findings: [
        {
          title: 'Shop scope taken from the request',
          message: 'The orders loader filters by the `shop` query parameter instead of the authenticated session.',
          severity: 'high',
          location: {file: 'app/routes/orders.tsx', line: 42, column: 7},
          evidence: [
            {
              location: {file: 'app/routes/orders.tsx', line: 42},
              quote: 'const shop = url.searchParams.get("shop")',
            },
          ],
          snippet: 'const shop = url.searchParams.get("shop")\nconst orders = await db.order.findMany({where: {shop}})',
          fix: {description: 'Read the shop from the authenticated admin session instead.'},
          agent_confidence: 'high',
          agent_reasoning: 'The parameter flows into the tenant filter with no comparison against the session shop.',
        },
      ],
    },
    {check_id: 'MISSING_EMBEDDED_CSP', outcome: 'clean', inspected_files: ['app/entry.server.tsx'], findings: []},
    {check_id: 'APP_PROXY_UNVERIFIED_SIGNATURE', outcome: 'not_applicable', inspected_files: [], findings: []},
    {
      check_id: 'DEPENDENCY_REACHABILITY',
      outcome: 'unresolved',
      inspected_files: ['package.json'],
      reason: 'The lockfile is absent, so installed dependency versions could not be determined.',
      guidance: 'Commit a lockfile or run the check in an environment with installed dependencies.',
      findings: [],
    },
  ],
}

/** Markdown description used by the agent instructions: one authoritative example plus the field rules. */
export function describeAppDoctorAgentFindingsDocument(): string {
  return `Each findings document is a single JSON object with this shape:

\`\`\`json
${JSON.stringify(EXAMPLE_DOCUMENT, null, 2)}
\`\`\`

Field rules:

- \`schema_version\` is always \`1\`.
- \`review\` is the exact \`--review\` token from this scope's record command, copied character for character. It binds the document to its scope; a document with a different or edited token is rejected.
- \`checks\` lists **every** check from the "Checks" section exactly once, using its \`check_id\` verbatim.
- \`outcome\` is one of:
  - \`clean\`: the check was investigated and no verified issue exists. \`findings\` must be empty.
  - \`findings\`: at least one verified issue exists. \`findings\` must be non-empty.
  - \`not_applicable\`: the app has no capability this check covers. \`findings\` must be empty; \`inspected_files\` may be empty.
  - \`unresolved\`: the check could not be completed. \`findings\` must be empty, and \`reason\` (what blocked the investigation) and \`guidance\` (what would unblock it) are required. Neither field is allowed for any other outcome.
- \`inspected_files\` lists the files you read for this check, as paths relative to the scope directory using \`/\` separators. Never absolute paths, \`..\` segments, or backslashes. Only files under the scope directory may appear.
- Each finding requires \`title\`, \`message\`, \`severity\` (\`high\`, \`medium\`, or \`low\`), \`location\` (\`file\` plus optional one-based \`line\` and \`column\`), \`evidence\` (an array of \`location\` plus optional minimal \`quote\`), \`fix\` (a \`description\` and optional \`guide\`), \`agent_confidence\` (\`high\`, \`medium\`, or \`low\`), and \`agent_reasoning\`. \`snippet\` is optional. Paths in \`location\` and \`evidence\` follow the same scope-relative rule as \`inspected_files\`.
- Don't add fields that aren't listed here. Check identity, provenance, scoring, and fingerprints are derived by the CLI at record time.
- Never place a secret value in any field. Quote only the minimum source needed to establish a finding.`
}

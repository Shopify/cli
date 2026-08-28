import {EMBEDDED_CHECK_SOURCES} from './embedded.js'
import {redactText} from '../rules/secret-rules.js'
import {createHash} from 'node:crypto'
import type {CheckExecution, FindingEvidence, Issue, Severity} from '../types.js'

/**
 * Semantic checks — the agentic review track.
 *
 * Some questions are facts and some are judgements. "Is this API version
 * end-of-life" is a lookup: a static rule answers it exactly, every time.
 * "Is this query scoped to one tenant" is not — answering it requires
 * following inheritance, resolving a receiver back to its caller, and
 * reading a schema. A line-oriented matcher cannot do that.
 *
 * So the agentic track ships a *prompt*, not a rule. The developer's agent
 * — which already has repository access — runs the prompt, explores the
 * code, and reports findings. app-doctor never calls a model: no API key,
 * no network, five dependencies. It emits the question and ingests the
 * answer.
 *
 * This is a parallel track, not a pipeline. The deterministic scan finds
 * what it can (facts); the agentic review finds what the scan cannot
 * (semantic judgements). Neither feeds the other.
 */

export interface Check {
  id: string
  version: number
  tier: 'agentic'
  severity: string
  prompt: string
  /** Hash of the prompt body. Recorded on every finding so a verdict is
   * traceable to the exact wording that produced it. */
  prompt_hash: string
}

const parseFrontmatter = (raw: string): {meta: Record<string, string>; body: string} => {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw)
  if (!match) return {meta: {}, body: raw}
  const [, frontmatter = '', prompt = ''] = match
  const meta: Record<string, string> = {}
  for (const line of frontmatter.split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  return {meta, body: prompt.trim()}
}

export const loadChecks = (): Map<string, Check> => {
  const checks = new Map<string, Check>()

  for (const source of EMBEDDED_CHECK_SOURCES) {
    const {meta, body} = parseFrontmatter(source)
    if (!meta.id) continue
    checks.set(meta.id, {
      id: meta.id,
      version: Number(meta.version ?? 1),
      tier: 'agentic',
      severity: meta.severity ?? 'medium',
      prompt: body,
      prompt_hash: `sha256:${createHash('sha256').update(body).digest('hex')}`,
    })
  }
  return checks
}

export interface ReviewPack {
  doctor_version: string
  generated_at: string
  checks: Pick<Check, 'id' | 'version' | 'prompt_hash' | 'prompt' | 'severity'>[]
  instructions: string
}

const INSTRUCTIONS = `Each check below is a prompt for you to run against this
codebase. For each one, explore the repository, find real instances of what
it describes, and report them with evidence.

Write the results to a JSON file:

  { "checks_executed": [ { "check_id": "...", "check_version": N, "prompt_hash": "sha256:..." } ],
    "findings": [ { "check_id": "...", "check_version": N, ...fields... } ] }

Then run: shopify app doctor scan --findings <that file>

Rules:
- Only report findings you verified by reading the code.
- Every finding must cite at least one file and line.
- Record every completed check in checks_executed, even when it found nothing.
- Don't report things you couldn't confirm — uncertainty is not a finding.`

/**
 * Build the review pack — the prompts for the developer's agent.
 * No candidates, no scan output. The agent explores independently.
 */
export const buildReviewPack = (doctorVersion: string): ReviewPack => ({
  doctor_version: doctorVersion,
  generated_at: new Date().toISOString(),
  checks: [...loadChecks().values()].map((check) => ({
    id: check.id,
    version: check.version,
    prompt_hash: check.prompt_hash,
    prompt: check.prompt,
    severity: check.severity,
  })),
  instructions: INSTRUCTIONS,
})

/**
 * A finding reported by the developer's agent after running a check prompt.
 */
export interface AgentFinding {
  check_id: string
  check_version: number
  prompt_hash: string
  file: string
  line: number
  message: string
  snippet?: string
  evidence?: {file: string; line?: number; quote?: string}[]
  confidence?: 'high' | 'medium' | 'low'
  reasoning?: string
}

/**
 * Convert an agent finding into an Issue for the trace.
 * Agent findings are "agentic" confidence — advisory until confirmed, but
 * carrying more weight than a heuristic guess because the agent read the code.
 */
const SEVERITY_POINTS: Record<string, number> = {
  critical: -25,
  high: -15,
  medium: -10,
  low: -5,
}

export const findingToIssue = (finding: AgentFinding, check: Check): Issue => ({
  id: check.id,
  severity: (check.severity as Severity) ?? 'medium',
  points: SEVERITY_POINTS[check.severity] ?? -10,
  title: check.id
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase()),
  message: redactText(finding.message),
  location: {
    file: redactText(finding.file.replace(/\\/g, '/')),
    line: finding.line,
  },
  snippet: finding.snippet === undefined ? undefined : redactText(finding.snippet),
  evidence: finding.evidence?.map(
    (item): FindingEvidence => ({
      location: {
        file: redactText(item.file.replace(/\\/g, '/')),
        ...(item.line === undefined ? {} : {line: item.line}),
      },
      ...(item.quote === undefined ? {} : {quote: redactText(item.quote)}),
    }),
  ),
  fix: {
    automated: false,
    description: "See the agent's reasoning and evidence.",
  },
  confidence: 'agentic',
  found_by: 'agent',
  // check_version and prompt_hash are taken from the CHECK WE LOADED, never
  // from the finding. The finding's copies are untrusted input; they are
  // validated in mergeFindings and then discarded. Copying them through would
  // let anyone editing findings.json claim any provenance they liked, which
  // would defeat the point of recording provenance at all.
  check_version: check.version,
  prompt_hash: check.prompt_hash,
  agent_confidence: finding.confidence,
  agent_reasoning: finding.reasoning === undefined ? undefined : redactText(finding.reasoning),
})

/**
 * A finding is only usable if it is grounded. An answer with no evidence is
 * a claim, and claims are what this whole mechanism exists to avoid taking
 * at face value.
 */
/** Caps on agent-supplied text, so a malformed findings.json cannot produce an
 *  unbounded submission artifact. Generous enough for real findings. */
const MAX_MESSAGE_LENGTH = 4_000
const MAX_SNIPPET_LENGTH = 4_000
const MAX_REASONING_LENGTH = 8_000
const MAX_EVIDENCE = 50
const MAX_QUOTE_LENGTH = 4_000
const MAX_PATH_LENGTH = 1_024
const MAX_FINDINGS = 1_000

/**
 * Reject paths that escape the app root or are absolute.
 *
 * `findings.json` is developer-controlled input that ends up verbatim in the
 * trace submitted to Shopify. A path like `../../../etc/passwd` is never a
 * legitimate finding location, and file-keyed lookups (file_hashes, staleness)
 * assume project-relative paths.
 */
export const isSafeRelativePath = (path: string): boolean => {
  if (!path) return false
  // Reject absolute POSIX and Windows paths.
  if (path.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(path)) return false
  if (path.includes('\0')) return false
  // Normalise separators and reject any traversal segment.
  const segments = path.replace(/\\/g, '/').split('/')
  return !segments.includes('..')
}

export const validateFinding = (finding: AgentFinding): string | undefined => {
  if (!finding || typeof finding !== 'object') return 'finding must be an object'
  if (!finding.check_id) return 'missing check_id'
  if (!finding.file) return 'missing file'
  if (!finding.line) return 'missing line'
  if (!finding.message) return 'missing message'
  if (!finding.prompt_hash) return 'missing prompt_hash'
  if (!finding.evidence || finding.evidence.length === 0) return 'finding requires at least one evidence citation'
  if (finding.evidence.length > MAX_EVIDENCE) return `finding exceeds ${MAX_EVIDENCE} evidence citations`
  if (finding.file.length > MAX_PATH_LENGTH) return `file path exceeds ${MAX_PATH_LENGTH} characters`
  if (!isSafeRelativePath(finding.file))
    return `unsafe file path (must be relative and inside the app): ${finding.file}`
  if (!Number.isInteger(finding.line) || finding.line < 1) return `invalid line number: ${finding.line}`
  if (finding.message.length > MAX_MESSAGE_LENGTH) return `message exceeds ${MAX_MESSAGE_LENGTH} characters`
  if (finding.snippet && finding.snippet.length > MAX_SNIPPET_LENGTH)
    return `snippet exceeds ${MAX_SNIPPET_LENGTH} characters`
  if (finding.reasoning && finding.reasoning.length > MAX_REASONING_LENGTH)
    return `reasoning exceeds ${MAX_REASONING_LENGTH} characters`
  for (const evidence of finding.evidence) {
    if (!isSafeRelativePath(evidence.file)) return `unsafe evidence file path: ${evidence.file}`
    if (evidence.file.length > MAX_PATH_LENGTH) return `evidence file path exceeds ${MAX_PATH_LENGTH} characters`
    if (evidence.line !== undefined && (!Number.isInteger(evidence.line) || evidence.line < 1))
      return `invalid evidence line number: ${evidence.line}`
    if (evidence.quote && evidence.quote.length > MAX_QUOTE_LENGTH)
      return `evidence quote exceeds ${MAX_QUOTE_LENGTH} characters`
  }
  return undefined
}

/**
 * Merge agent findings into a scan result's issues.
 * Returns the count of accepted and rejected findings.
 */
export const mergeFindings = (
  issues: Issue[],
  findings: AgentFinding[],
  options: {knownFiles?: ReadonlySet<string>} = {},
): {accepted: number; rejected: string[]} => {
  const checks = loadChecks()
  const rejected: string[] = []
  let accepted = 0

  if (findings.length > MAX_FINDINGS) {
    rejected.push(`findings file contains ${findings.length} findings, exceeding the limit of ${MAX_FINDINGS}`)
    return {accepted: 0, rejected}
  }

  for (const finding of findings) {
    const problem = validateFinding(finding)
    if (problem) {
      const id = finding && typeof finding === 'object' ? finding.check_id : '<unknown>'
      rejected.push(`${id}: ${problem}`)
      continue
    }
    if (options.knownFiles && !options.knownFiles.has(redactText(finding.file.replace(/\\/g, '/')))) {
      rejected.push(`${finding.check_id}: finding file was not part of the scanned inputs: ${finding.file}`)
      continue
    }
    if (options.knownFiles) {
      const unknownEvidence = finding.evidence?.find(
        (item) => !options.knownFiles!.has(redactText(item.file.replace(/\\/g, '/'))),
      )
      if (unknownEvidence) {
        rejected.push(`${finding.check_id}: evidence file was not part of the scanned inputs: ${unknownEvidence.file}`)
        continue
      }
    }
    const check = checks.get(finding.check_id)
    if (!check) {
      rejected.push(`${finding.check_id}: unknown check`)
      continue
    }
    if (finding.check_version !== check.version) {
      rejected.push(
        `${finding.check_id}: version mismatch (finding v${finding.check_version}, current v${check.version})`,
      )
      continue
    }
    // The prompt hash is the strongest provenance claim in the trace: it binds
    // a verdict to the exact prompt wording that produced it. Validate it with
    // the same rigour as the version rather than trusting the agent's copy.
    if (finding.prompt_hash !== check.prompt_hash) {
      rejected.push(
        `${finding.check_id}: prompt_hash mismatch (finding ${finding.prompt_hash.slice(0, 12)}…, current ${check.prompt_hash.slice(0, 12)}…) — the finding was produced by a different prompt revision`,
      )
      continue
    }
    issues.push(findingToIssue(finding, check))
    accepted++
  }

  return {accepted, rejected}
}

export interface AgentFindingsDocument {
  findings: AgentFinding[]
  /** Checks the agent actually completed, including those with zero findings. */
  checks_executed?: {
    check_id: string
    check_version: number
    prompt_hash: string
  }[]
}

export function validateAgentChecksExecuted(document: AgentFindingsDocument): {
  executions: CheckExecution[]
  rejected: string[]
} {
  const checks = loadChecks()
  const rejected: string[] = []
  const seen = new Set<string>()
  const executions: CheckExecution[] = []
  if (document.checks_executed !== undefined && !Array.isArray(document.checks_executed))
    return {executions, rejected: ['checks_executed must be an array']}
  for (const claimed of document.checks_executed ?? []) {
    const check = checks.get(claimed.check_id)
    if (!check) {
      rejected.push(`${claimed.check_id}: unknown executed check`)
      continue
    }
    if (seen.has(claimed.check_id)) {
      rejected.push(`${claimed.check_id}: duplicate executed check`)
      continue
    }
    if (claimed.check_version !== check.version || claimed.prompt_hash !== check.prompt_hash) {
      rejected.push(`${claimed.check_id}: executed-check provenance mismatch`)
      continue
    }
    seen.add(claimed.check_id)
    executions.push({
      id: check.id,
      version: check.version,
      kind: 'check',
      status: 'executed',
      findings: document.findings.filter((finding) => finding.check_id === check.id).length,
      prompt_hash: check.prompt_hash,
    })
  }
  return {executions, rejected}
}

import {captureOutputWithExitCode} from '@shopify/cli-kit/node/system'
import type {SourceFile} from './types.js'
import type {Issue} from '../types.js'

/**
 * Secret patterns. Each entry MUST place the sensitive material in capture
 * group 1 (or make the whole match sensitive when `wholeMatch` is set), because
 * redaction is derived from the pattern that fired rather than from a second,
 * separately-maintained list of redaction regexes.
 *
 * Why this shape: a previous version kept `keyPatterns` and a `redactLine()`
 * helper as independent lists. They drifted — an AWS pattern was added to the
 * detector with no matching entry in the redactor, so detected AWS keys were
 * printed verbatim into the console AND into the submitted trace. Deriving the
 * redaction span from the match makes that class of bug unrepresentable: if a
 * pattern can fire, its match is redacted.
 */
interface SecretPattern {
  regex: RegExp
  name: string
  /** When true the entire match is the secret; otherwise capture group 1 is. */
  wholeMatch?: boolean
  /** When true no part of the input is safe to retain after this pattern matches. */
  redactEntireInput?: boolean
}

export const SECRET_PATTERNS: SecretPattern[] = [
  // Shopify API secret (shpss_ prefix or 32 hex)
  {
    regex: /(?:api[_-]?secret|SHOPIFY_API_SECRET)\s*[:=]\s*['"](shpss_[a-f0-9]+|[a-f0-9]{32})['"]/i,
    name: 'Shopify API secret',
  },
  // Shopify access token (shpat_ / shpca_ / shppa_)
  {
    regex: /(?:access[_-]?token|SHOPIFY_ACCESS_TOKEN)\s*[:=]\s*['"](shp(?:at|ca|pa)_[a-zA-Z0-9]+)['"]/i,
    name: 'Shopify access token',
  },
  // Bare Shopify tokens, even without an assignment context
  {
    regex: /shp(?:at|ca|pa|ss)_[a-fA-F0-9]{16,}/,
    name: 'Shopify token',
    wholeMatch: true,
  },
  // Stripe secret/restricted keys. Publishable `pk_` keys are public by design.
  {
    regex: /(?:sk|rk)_(?:live|test)_[a-zA-Z0-9]{20,}/,
    name: 'Stripe API key',
    wholeMatch: true,
  },
  // AWS access key ID
  {regex: /AKIA[0-9A-Z]{16}/, name: 'AWS access key', wholeMatch: true},
  // AWS secret access key (40 char base64-ish, assignment context to limit noise)
  {
    regex: /aws[_-]?secret[_-]?access[_-]?key\s*[:=]\s*['"]([A-Za-z0-9/+=]{40})['"]/i,
    name: 'AWS secret access key',
  },
  // GitHub tokens
  {
    regex: /gh[pousr]_[A-Za-z0-9]{36,}/,
    name: 'GitHub token',
    wholeMatch: true,
  },
  // Google API key
  {regex: /AIza[0-9A-Za-z_-]{35}/, name: 'Google API key', wholeMatch: true},
  // Slack token
  {
    regex: /xox[baprs]-[0-9A-Za-z-]{10,}/,
    name: 'Slack token',
    wholeMatch: true,
  },
  // Match complete blocks first so arbitrary multiline output never retains key material or its footer.
  {
    regex: /-----BEGIN ((?:(?:RSA|EC|OPENSSH) )?PRIVATE KEY|PGP PRIVATE KEY BLOCK)-----[\s\S]*?-----END \1-----/,
    name: 'private key block',
    wholeMatch: true,
  },
  // Keep a header-only detector for line-oriented repository scanning and malformed/truncated keys.
  {
    regex: /-----BEGIN (?:(?:RSA|EC|OPENSSH) )?PRIVATE KEY-----|-----BEGIN PGP PRIVATE KEY BLOCK-----/,
    name: 'private key',
    wholeMatch: true,
    redactEntireInput: true,
  },
]

/**
 * Redact a line using the pattern that matched it.
 *
 * The redacted span is taken from the match itself, so any pattern added to
 * SECRET_PATTERNS is automatically covered. Never returns the raw secret.
 */
export function redactMatch(line: string, pattern: SecretPattern): string {
  const match = pattern.regex.exec(line)
  if (!match) return '[REDACTED]'
  if (pattern.redactEntireInput) return '[REDACTED LINE]'

  const secret = pattern.wholeMatch ? match[0] : match[1]
  if (!secret) return '[REDACTED]'

  // Keep a short prefix for identification (e.g. "AKIA…") but never enough to use.
  const keep = Math.min(4, Math.floor(secret.length / 4))
  const hint = keep > 0 ? secret.slice(0, keep) : ''
  const replaced = line.split(secret).join(`${hint}[REDACTED:${secret.length}]`)

  // Belt and braces: if the secret somehow survived, drop the line entirely.
  return replaced.includes(secret) ? '[REDACTED LINE]' : replaced
}

/** Redact every known secret occurrence from arbitrary scanner or agent text. */
export function redactText(text: string): string {
  let redacted = text
  for (const pattern of SECRET_PATTERNS) {
    // Patterns deliberately have no global flag. Re-run until all occurrences
    // are removed, with a guard against a future non-progressing pattern.
    for (let count = 0; count < 100; count++) {
      const match = pattern.regex.exec(redacted)
      if (!match) break
      const next = redactMatch(redacted, pattern)
      if (next === redacted) return '[REDACTED TEXT]'
      redacted = next
    }
    // Fail closed when hostile input contains more matches than the work cap.
    if (pattern.regex.test(redacted)) return '[REDACTED TEXT]'
  }
  return redacted
}

const ENV_FILE_PATTERN = /(^|\/)\.env(?:\.[^/]+)?$/
const NAMED_SECRET_FILE_PATTERN = /(^|\/)(?:\.env\.(?:secrets|keys)|(?:secrets|credentials)\.json)$/
const TEMPLATE_ENV_FILE_PATTERN = /(^|\/)\.env(?:\.[^/]+)*\.(?:example|sample|template|dist)$/i
// `SHOPIFY_API_KEY` / `api_key` are client IDs and public; they are not secret names.
const SECRET_ASSIGNMENT_PATTERN =
  /(?:api[_-]?secret|access[_-]?token|secret[_-]?key|private[_-]?key|password|SHOPIFY_API_SECRET)\s*[:=]\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^\s#'"\r\n][^#\r\n]*))/gi

function isTemplateEnvFile(path: string): boolean {
  return TEMPLATE_ENV_FILE_PATTERN.test(path)
}

function containsKnownSecretFormat(content: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.regex.test(content))
}

/**
 * Name matches are not evidence. Partners commit `.env.example` with
 * `SHOPIFY_API_SECRET=your-secret-here`; treating that as a leak is how this
 * check missed its own static-tier bar (provable facts, near-zero FPs).
 */
function isPlaceholderSecretValue(raw: string): boolean {
  const value = raw.trim()
  if (value.length === 0) return true
  if (/^<[^>\n]+>$/.test(value)) return true
  if (/^\$\{[^}]+}$/.test(value)) return true
  if (/^\$[A-Za-z_][A-Za-z0-9_]*$/.test(value)) return true
  if (/^(x{2,}|\*{2,}|\.{2,}|-{2,}|_{2,})$/i.test(value)) return true
  const compact = value.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (
    /^(changeme|placeholder|example|sample|dummy|fake|secret|password|todo|replaceme|insertme|none|null|undefined|na|nil)$/.test(
      compact,
    )
  ) {
    return true
  }
  if (/^(your|insert|replace|change).*(here|this|secret|key|token|password)$/.test(compact)) return true
  if (/^(example|sample|dummy|fake)/.test(compact)) return true
  return compact.includes('placeholder') || compact.includes('changeme')
}

function secretAssignmentValues(content: string): string[] {
  const pattern = new RegExp(SECRET_ASSIGNMENT_PATTERN.source, SECRET_ASSIGNMENT_PATTERN.flags)
  const values: string[] = []
  for (const match of content.matchAll(pattern)) {
    values.push((match[1] ?? match[2] ?? match[3] ?? '').trim())
  }
  return values
}

function containsCommittedSecretEvidence(content: string, templateFile: boolean): boolean {
  if (containsKnownSecretFormat(content)) return true
  if (templateFile) return false
  return secretAssignmentValues(content).some((value) => !isPlaceholderSecretValue(value))
}

function committedSecretFileIssue(file: SourceFile, status: GitFileStatus, environmentFile: boolean): Issue {
  const kind = environmentFile ? 'Environment file with secrets' : 'Secret file'
  const tracked = status.tracked === true
  const untrackedAndNotIgnored = status.tracked === false && status.ignored === false

  let title: string
  let message: string
  let fixDescription: string
  if (tracked) {
    title = `${kind} is tracked by git`
    message = `${file.path} IS TRACKED BY GIT (confirmed via git ls-files), so its contents are in the repository history. Rotate every exposed secret and purge the file from history.`
    fixDescription = `git rm --cached ${file.path}, add it to .gitignore, purge it from history, and rotate every exposed secret`
  } else if (untrackedAndNotIgnored) {
    title = `${kind} is not ignored by git`
    message = `${file.path} is untracked but not ignored. If committed, its contents enter repository history.`
    fixDescription = `Add ${file.path} to .gitignore, confirm with 'git check-ignore ${file.path}', and rotate any exposed secrets`
  } else {
    title = `${kind} could not be confirmed as ignored`
    message = `${file.path} could not be confirmed as untracked-and-ignored${status.reason ? ` (${status.reason})` : ''}. Confirm it is gitignored before treating this as clean.`
    fixDescription = `Add ${file.path} to .gitignore, confirm with 'git ls-files ${file.path}', and rotate any exposed secrets`
  }

  return {
    id: 'COMMITTED_SECRET',
    severity: 'high',
    points: -50,
    title,
    message,
    location: {file: file.path},
    detection_evidence: status.evidence,
    fix: {
      automated: false,
      description: fixDescription,
    },
  }
}

/** Rule 8: COMMITTED_SECRET (-50, high) */
export async function scanCommittedSecrets(secretEvidenceFiles: SourceFile[], appRoot: string): Promise<Issue[]> {
  const issues: Issue[] = []

  for (const file of secretEvidenceFiles) {
    if (file.content === undefined) continue
    const environmentFile = ENV_FILE_PATTERN.test(file.path)
    const namedSecretFile = NAMED_SECRET_FILE_PATTERN.test(file.path)
    if (!environmentFile && !namedSecretFile) continue

    const templateFile = isTemplateEnvFile(file.path)
    const hasEvidence = containsCommittedSecretEvidence(file.content, templateFile)
    const emptyNamedSecret = namedSecretFile && file.content.trim() === ''
    if (!hasEvidence && !emptyNamedSecret) continue

    // Keep git probes sequential to avoid spawning competing processes for one repository.
    // eslint-disable-next-line no-await-in-loop
    const status = await gitStatusFor(appRoot, file.path)
    // A safe local secret file is not a vulnerability or scoring event.
    if (status.tracked === false && status.ignored === true) continue
    // Empty named secret files stay fail-closed only when git confirms they are
    // tracked — history may still contain prior secrets. Unknown git plus empty
    // contents is not a provable leak.
    if (!hasEvidence) {
      if (emptyNamedSecret && status.tracked === true) {
        issues.push(committedSecretFileIssue(file, status, environmentFile))
      }
      continue
    }
    issues.push(committedSecretFileIssue(file, status, environmentFile))
  }

  for (const file of secretEvidenceFiles) {
    if (!file.content || ENV_FILE_PATTERN.test(file.path) || NAMED_SECRET_FILE_PATTERN.test(file.path)) continue

    const lines = file.content.split('\n')
    for (const [index, line] of lines.entries()) {
      for (const pattern of SECRET_PATTERNS) {
        // Patterns are non-global so `.test()` has no lastIndex state to leak
        // between iterations. Do not add the /g flag here.
        if (!pattern.regex.test(line)) continue
        issues.push({
          id: 'COMMITTED_SECRET',
          severity: 'high',
          points: -50,
          title: `Hardcoded ${pattern.name} detected`,
          message: `A ${pattern.name} pattern was found in repository text. Never hardcode secrets — use environment variables.`,
          location: {file: file.path, line: index + 1},
          snippet: redactMatch(line, pattern),
          fix: {
            automated: false,
            description: 'Move the secret to an environment variable and rotate it immediately',
          },
        })
      }
    }
  }

  return issues
}

/**
 * Ask git directly whether a file is tracked and whether it is ignored.
 *
 * Hand-parsing .gitignore cannot answer either question correctly:
 *   - Presence in .gitignore does NOT imply the file is untracked. A file
 *     committed before being ignored stays tracked, and its secrets stay in
 *     history. That is the most common real-world leak, and the previous
 *     hand-rolled check downgraded exactly that case from high to medium.
 *   - Real gitignore semantics include negation (!pattern), directory scoping,
 *     nested .gitignore files, ** globs and precedence rules. A substring and
 *     trailing-* check gets all of them wrong.
 *
 * `tracked`/`ignored` are tri-state: `undefined` means "could not determine"
 * (no git, not a repo, git failed). Callers MUST treat undefined as unsafe.
 */
interface GitFileStatus {
  /** true = git tracks it, false = git confirms untracked, undefined = unknown */
  tracked?: boolean
  /** true = git confirms ignored, false = not ignored, undefined = unknown */
  ignored?: boolean
  /** Why the status is unknown, when it is. */
  reason?: string
  /** Commands run and their verdicts, for the trace. */
  evidence?: string[]
}

export async function gitStatusFor(appRoot: string, file: string): Promise<GitFileStatus> {
  const run = async (args: string[]): Promise<{exitCode?: number; out: string}> => {
    try {
      const result = await captureOutputWithExitCode('git', args, {cwd: appRoot})
      return {exitCode: result.exitCode, out: result.stdout.trim()}
      // Missing Git or a failed probe is unknown status, not proof the file is safe.
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      return {exitCode: undefined, out: ''}
    }
  }

  // Is this even a git repo? If not, we cannot confirm anything.
  const inRepo = await run(['rev-parse', '--is-inside-work-tree'])
  if (inRepo.exitCode !== 0 || inRepo.out !== 'true') {
    return {
      tracked: undefined,
      ignored: undefined,
      reason: 'not a git repository, or git unavailable',
      evidence: ['git rev-parse --is-inside-work-tree → not a work tree'],
    }
  }

  const evidence: string[] = []

  // Exit 1 is git's conclusive "no match" result. Any other failure remains
  // unknown instead of being silently interpreted as an untracked file.
  const ls = await run(['ls-files', '--error-unmatch', '--', file])
  let tracked: boolean | undefined
  if (ls.exitCode === 0 && ls.out.length > 0) tracked = true
  else if (ls.exitCode === 1) tracked = false
  let trackedVerdict = 'unknown'
  if (tracked === true) trackedVerdict = 'TRACKED'
  else if (tracked === false) trackedVerdict = 'untracked'
  evidence.push(`git ls-files --error-unmatch ${file} → ${trackedVerdict}`)

  // check-ignore likewise defines 0 as ignored and 1 as conclusively not
  // ignored. Exit codes above 1 are command errors and must fail closed.
  const checkIgnore = await run(['check-ignore', '-q', '--', file])
  let ignored: boolean | undefined
  if (checkIgnore.exitCode === 0) ignored = true
  else if (checkIgnore.exitCode === 1) ignored = false
  let ignoredVerdict = 'unknown'
  if (ignored === true) ignoredVerdict = 'ignored'
  else if (ignored === false) ignoredVerdict = 'not ignored'
  evidence.push(`git check-ignore -q ${file} → ${ignoredVerdict}`)

  return {
    tracked,
    ignored,
    ...(tracked === undefined || ignored === undefined ? {reason: 'git status command failed'} : {}),
    evidence,
  }
}

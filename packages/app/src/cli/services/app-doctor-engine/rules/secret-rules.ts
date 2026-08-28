import {fileExistsSync, readFileSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
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
export interface SecretPattern {
  regex: RegExp
  name: string
  /** When true the entire match is the secret; otherwise capture group 1 is. */
  wholeMatch?: boolean
}

export const SECRET_PATTERNS: SecretPattern[] = [
  // Shopify API key (32 hex chars)
  {
    regex: /(?:api[_-]?key|client[_-]?id|SHOPIFY_API_KEY)\s*[:=]\s*['"]([a-f0-9]{32})['"]/i,
    name: 'Shopify API key',
  },
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
  // Stripe keys
  {
    regex: /(?:sk|pk|rk)_(?:live|test)_[a-zA-Z0-9]{20,}/,
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
  // Private key PEM blocks
  {
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/,
    name: 'private key',
    wholeMatch: true,
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

/** Rule 8: COMMITTED_SECRET (-50, critical) */
export async function scanCommittedSecrets(sourceFiles: SourceFile[], appRoot: string): Promise<Issue[]> {
  const issues: Issue[] = []

  // Check for .env files present in the project
  const envPatterns = ['.env', '.env.local', '.env.production', '.env.development']
  for (const envFile of envPatterns) {
    const envPath = joinPath(appRoot, envFile)
    if (fileExistsSync(envPath)) {
      // Keep git probes sequential to avoid spawning competing processes for one repository.
      // eslint-disable-next-line no-await-in-loop
      const status = await gitStatusFor(appRoot, envFile)
      // Check whether the file actually contains secret-like values.
      // A .env with only HOST= is not a secret leak.
      const content = readFileSync(envPath).toString()
      const hasSecrets =
        /(?:api[_-]?key|api[_-]?secret|access[_-]?token|secret[_-]?key|private[_-]?key|password|SHOPIFY_API_KEY|SHOPIFY_API_SECRET)\s*[:=]/i.test(
          content,
        )

      if (hasSecrets) {
        // Only a file that git confirms is BOTH untracked and ignored may be
        // downgraded. Being listed in .gitignore proves nothing on its own:
        // a file committed before it was ignored stays tracked forever, which
        // is the single most common way secrets leak. Anything we cannot
        // positively confirm as safe stays critical (fail closed).
        const safe = status.tracked === false && status.ignored === true
        let title = 'Environment file with secrets committed to repository'
        let message = `${envFile} contains secret-like values and its git status could not be determined${status.reason ? ` (${status.reason})` : ''}. Treating as exposed. Rotate any exposed secrets and confirm the file is untracked.`
        let fixDescription = `Add ${envFile} to .gitignore, confirm with 'git ls-files ${envFile}', and rotate secrets if it was ever committed`
        if (safe) {
          title = 'Environment file with secrets (untracked and gitignored)'
          message = `${envFile} contains secret-like values. git confirms it is untracked and ignored, so it is not in the repository. Keep it that way.`
          fixDescription = `No action required beyond keeping ${envFile} out of version control`
        } else if (status.tracked === true) {
          title = 'Environment file with secrets is tracked by git'
          message = `${envFile} contains secret-like values and IS TRACKED BY GIT (confirmed via git ls-files), so the secrets are in the repository history${status.ignored ? ' — adding it to .gitignore after committing does not remove it' : ''}. Rotate every exposed secret and purge the file from history.`
          fixDescription = `git rm --cached ${envFile}, add it to .gitignore, purge it from history (git filter-repo), and rotate every secret it contained`
        }
        issues.push({
          id: 'COMMITTED_SECRET',
          severity: safe ? 'medium' : 'critical',
          points: safe ? -7 : -50,
          title,
          message,
          location: {file: envFile},
          detection_evidence: status.evidence,
          fix: {
            automated: false,
            description: fixDescription,
          },
        })
      } else {
        // .env file exists but contains no secrets — low-priority advisory.
        issues.push({
          id: 'COMMITTED_SECRET',
          severity: 'low',
          points: -2,
          title: 'Environment file present (no secrets detected)',
          message: `${envFile} is present but does not appear to contain secret values. Verify it is in .gitignore to prevent future secrets from being committed.`,
          location: {file: envFile},
          fix: {
            automated: false,
            description: `Add ${envFile} to .gitignore as a precaution`,
          },
        })
      }
    }
  }

  // Check for .env.secrets and similar
  const secretFiles = ['.env.secrets', '.env.keys', 'secrets.json', 'credentials.json']
  for (const secretFile of secretFiles) {
    const secretPath = joinPath(appRoot, secretFile)
    if (!fileExistsSync(secretPath)) continue
    // Keep git probes sequential to avoid spawning competing processes for one repository.
    // eslint-disable-next-line no-await-in-loop
    const status = await gitStatusFor(appRoot, secretFile)
    // Fail closed: only skip when git positively confirms untracked + ignored.
    if (!(status.tracked === false && status.ignored === true)) {
      issues.push({
        id: 'COMMITTED_SECRET',
        severity: 'critical',
        points: -50,
        title: status.tracked === true ? 'Secret file is tracked by git' : 'Secret file in repository',
        message:
          status.tracked === true
            ? `${secretFile} IS TRACKED BY GIT (confirmed via git ls-files), so its contents are in the repository history. Rotate every secret it contains and purge it from history.`
            : `${secretFile} is present in the project and could not be confirmed as untracked-and-ignored${status.reason ? ` (${status.reason})` : ''}. Treating as exposed.`,
        location: {file: secretFile},
        detection_evidence: status.evidence,
        fix: {
          automated: false,
          description:
            status.tracked === true
              ? `git rm --cached ${secretFile}, add it to .gitignore, purge from history, and rotate every secret`
              : `Add ${secretFile} to .gitignore, confirm with 'git ls-files ${secretFile}', and rotate any exposed secrets`,
        },
      })
    }
  }

  // Scan source files for hardcoded API key patterns
  for (const file of sourceFiles) {
    if (!file.content) continue
    // Skip .env files (already checked above), node_modules, and test files
    if (file.path.includes('node_modules')) continue
    if (file.path.endsWith('.env') || file.path.includes('.env.')) continue
    if (file.path.includes('.test.') || file.path.includes('.spec.')) continue
    // Skip test fixture/config files — app-configs, test-utils, fixtures
    if (/app[._-]?configs|test[._-]?utils|fixtures/i.test(file.path)) continue

    const lines = file.content.split('\n')
    for (const [i, line] of lines.entries()) {
      for (const pattern of SECRET_PATTERNS) {
        // Patterns are non-global so `.test()` has no lastIndex state to leak
        // between iterations. Do not add the /g flag here.
        if (!pattern.regex.test(line)) continue
        issues.push({
          id: 'COMMITTED_SECRET',
          severity: 'critical',
          points: -50,
          title: `Hardcoded ${pattern.name} detected`,
          message: `A ${pattern.name} pattern was found in source code. Never hardcode secrets — use environment variables.`,
          location: {file: file.path, line: i + 1},
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
 *     hand-rolled check downgraded exactly that case from critical to medium.
 *   - Real gitignore semantics include negation (!pattern), directory scoping,
 *     nested .gitignore files, ** globs and precedence rules. A substring and
 *     trailing-* check gets all of them wrong.
 *
 * `tracked`/`ignored` are tri-state: `undefined` means "could not determine"
 * (no git, not a repo, git failed). Callers MUST treat undefined as unsafe.
 */
export interface GitFileStatus {
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
  const run = async (args: string[]): Promise<{ok: boolean; out: string}> => {
    const result = await captureOutputWithExitCode('git', args, {cwd: appRoot})
    return {ok: result.exitCode === 0, out: result.stdout.trim()}
  }

  // Is this even a git repo? If not, we cannot confirm anything.
  const inRepo = await run(['rev-parse', '--is-inside-work-tree'])
  if (!inRepo.ok || inRepo.out !== 'true') {
    return {
      tracked: undefined,
      ignored: undefined,
      reason: 'not a git repository, or git unavailable',
      evidence: ['git rev-parse --is-inside-work-tree → not a work tree'],
    }
  }

  const evidence: string[] = []

  // Tracked? `git ls-files --error-unmatch` exits non-zero when untracked.
  const ls = await run(['ls-files', '--error-unmatch', '--', file])
  const tracked = ls.ok && ls.out.length > 0
  evidence.push(`git ls-files --error-unmatch ${file} → ${tracked ? 'TRACKED' : 'untracked'}`)

  // Ignored? `git check-ignore -q` exits 0 when the path is ignored. It applies
  // full gitignore semantics including negation and nested ignore files.
  const ci = await run(['check-ignore', '-q', '--', file])
  const ignored = ci.ok
  evidence.push(`git check-ignore -q ${file} → ${ignored ? 'ignored' : 'not ignored'}`)

  return {tracked, ignored, evidence}
}

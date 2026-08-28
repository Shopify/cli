/* eslint-disable id-length, line-comment-position, no-restricted-imports -- security fixtures exercise raw git and filesystem behavior */
import {scan} from '../scanners/index.js'
import {SECRET_PATTERNS, redactMatch, gitStatusFor} from '../rules/secret-rules.js'
import {describe, expect, test} from 'vitest'
import {mkdtempSync, writeFileSync, mkdirSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {execFileSync} from 'node:child_process'

/**
 * Regression tests for two defects found in review, both of which the existing
 * suite and the eval gate passed cleanly:
 *
 *   1. The secret scanner printed detected AWS keys verbatim into the console
 *      AND into app-doctor-trace.json — the artifact developers are told to
 *      submit to Shopify. Detection patterns and redaction patterns were two
 *      independent lists, and they drifted.
 *
 *   2. A .env that was committed and only afterwards added to .gitignore was
 *      downgraded from critical to medium, because the rule inferred "not
 *      committed" from the presence of a line in .gitignore. That is the most
 *      common real-world secret leak, and the tool called it safe.
 *
 * The eval gate reported 100% precision throughout, because precision only
 * asks "did we flag the fixture", never "did we handle the finding safely".
 *
 * ────────────────────────────────────────────────────────────────────────────
 * NOTE ON TEST DATA
 *
 * Every credential-shaped value below is ASSEMBLED AT RUNTIME from fragments
 * rather than written as a literal. All values are non-functional, but their
 * *shape* is real by design — that is the whole point of the test — and a
 * literal would be flagged by GitHub push protection and by any other secret
 * scanner pointed at this repository. (The first version of this file was
 * rejected by GitHub push protection for exactly that reason, which is a
 * decent live demonstration of the bug being fixed here.)
 *
 * Keep it that way: never paste a literal credential-shaped string into this
 * file, even a fake one.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** Assemble a credential-shaped probe value without writing a literal. */
const compose = (prefix: string, body: string): string => `${prefix}${body}`

const HEX32 = '0123456789abcdef'.repeat(2)
const ALNUM = 'abcdefghijklmnopqrstuvwxyz0123456789'

const PROBES = {
  awsAccessKey: compose('AKIA', 'IOSFODNN7EXAMPLE'),
  awsSecretKey: compose('wJalrXUtnFEMI', 'K7MDENGbPxRfiCYEXAMPLEKEY12'),
  stripeLive: compose('sk_', `live_51H8xQ2eZvKYlo2C${ALNUM.slice(0, 24)}`),
  shopifyToken: compose('shp', `at_${HEX32}`),
  shopifySecret: compose('shp', `ss_${HEX32}`),
  githubToken: compose('gh', `p_${ALNUM.repeat(2).slice(0, 36)}`),
  googleKey: compose('AIza', `Sy${ALNUM.repeat(2).slice(0, 33)}`),
  slackToken: compose('xox', `b-123456789012-${ALNUM.slice(0, 16)}`),
  pemHeader: compose('-----BEGIN ', 'RSA PRIVATE KEY-----'),
}

const TOML = `name = "t"
client_id = "abc123"
application_url = "https://example.com"
[access_scopes]
scopes = "read_orders"
[webhooks]
api_version = "2025-01"
`

const makeApp = (files: Record<string, string>): string => {
  const dir = mkdtempSync(join(tmpdir(), 'doctor-secret-'))
  writeFileSync(join(dir, 'shopify.app.toml'), TOML)
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path)
    mkdirSync(join(full, '..'), {recursive: true})
    writeFileSync(full, content)
  }
  return dir
}

const git = (dir: string, args: string[]) =>
  execFileSync('git', args, {
    cwd: dir,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@t',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@t',
    },
  })

describe('redaction never emits the secret it detected', () => {
  const samples: [string, string][] = [
    ['AWS access key', `const k = "${PROBES.awsAccessKey}";`],
    ['Stripe API key', `const k = "${PROBES.stripeLive}";`],
    ['Shopify token', `const k = "${PROBES.shopifyToken}";`],
    ['GitHub token', `const k = "${PROBES.githubToken}";`],
    ['Google API key', `const k = "${PROBES.googleKey}";`],
    ['Slack token', `const k = "${PROBES.slackToken}";`],
    ['Shopify API key', `const apiKey = "${HEX32}";`],
  ]

  for (const [label, line] of samples) {
    test(`redacts ${label} in the snippet`, () => {
      const matching = SECRET_PATTERNS.filter((p) => p.regex.test(line))
      expect(matching.length, `no pattern detected ${label}`).toBeGreaterThan(0)

      for (const pattern of matching) {
        const match = pattern.regex.exec(line)!
        const secret = pattern.wholeMatch ? match[0] : match[1]
        const redacted = redactMatch(line, pattern)
        expect(redacted, `${label} leaked via ${pattern.name}`).not.toContain(secret)
        expect(redacted).toContain('REDACTED')
      }
    })
  }

  test('every detection pattern has working redaction — no drift between the two', () => {
    // The original bug: a pattern existed in the detector with no counterpart
    // in the redactor. Assert the property directly for every pattern rather
    // than trusting that two hand-maintained lists stay in sync.
    let exercised = 0
    for (const pattern of SECRET_PATTERNS) {
      const probe = probeFor(pattern.name)
      if (!probe || !pattern.regex.test(probe)) continue
      exercised++
      const match = pattern.regex.exec(probe)!
      const secret = pattern.wholeMatch ? match[0] : match[1]
      expect(redactMatch(probe, pattern), `${pattern.name} has no effective redaction`).not.toContain(secret)
    }
    // Guard against the probe table silently falling out of date and making
    // this test vacuous.
    expect(exercised).toBeGreaterThanOrEqual(SECRET_PATTERNS.length - 1)
  })

  test('does not leak a detected secret into the trace written for submission', async () => {
    const dir = makeApp({
      'config.js': `const awsKey = "${PROBES.awsAccessKey}";\n`,
    })
    const result = await scan(dir)
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain(PROBES.awsAccessKey)
    expect(serialized).toContain('REDACTED')
    rmSync(dir, {recursive: true, force: true})
  })
})

describe('git status drives severity, not .gitignore text', () => {
  test('keeps a tracked .env CRITICAL even when it is listed in .gitignore', async () => {
    // The classic leak: commit the file, then gitignore it and assume safety.
    const dir = makeApp({})
    git(dir, ['init', '-q', '.'])
    writeFileSync(join(dir, '.env'), 'SHOPIFY_API_SECRET=placeholder-value-here\n')
    git(dir, ['add', '-f', '.env'])
    git(dir, ['commit', '-qm', 'oops'])
    writeFileSync(join(dir, '.gitignore'), '.env\n')

    expect(git(dir, ['ls-files', '.env']).trim()).toBe('.env') // still tracked

    const result = await scan(dir)
    const finding = result.issues.find((i) => i.id === 'COMMITTED_SECRET')
    expect(finding).toBeDefined()
    expect(finding!.severity).toBe('critical')
    expect(finding!.points).toBe(-50)
    expect(finding!.detection_evidence?.join(' ')).toContain('TRACKED')
    rmSync(dir, {recursive: true, force: true})
  })

  test('downgrades only when git confirms the file is untracked AND ignored', async () => {
    const dir = makeApp({})
    git(dir, ['init', '-q', '.'])
    writeFileSync(join(dir, '.gitignore'), '.env\n')
    git(dir, ['add', '.gitignore'])
    git(dir, ['commit', '-qm', 'init'])
    writeFileSync(join(dir, '.env'), 'SHOPIFY_API_SECRET=placeholder-value-here\n')

    const result = await scan(dir)
    const finding = result.issues.find((i) => i.id === 'COMMITTED_SECRET')
    expect(finding).toBeDefined()
    expect(finding!.severity).toBe('medium')
    rmSync(dir, {recursive: true, force: true})
  })

  test('fails closed when git cannot answer (no repository)', async () => {
    // Unknown status must never be treated as safe.
    const dir = makeApp({})
    writeFileSync(join(dir, '.env'), 'SHOPIFY_API_SECRET=placeholder-value-here\n')
    writeFileSync(join(dir, '.gitignore'), '.env\n')

    const result = await scan(dir)
    const finding = result.issues.find((i) => i.id === 'COMMITTED_SECRET')
    expect(finding).toBeDefined()
    expect(finding!.severity).toBe('critical')
    rmSync(dir, {recursive: true, force: true})
  })

  test('reports tri-state status rather than a boolean guess', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'doctor-nogit-'))
    const status = await gitStatusFor(dir, '.env')
    // Outside a repo both answers are unknown — not `false`.
    expect(status.tracked).toBeUndefined()
    expect(status.ignored).toBeUndefined()
    expect(status.reason).toBeTruthy()
    rmSync(dir, {recursive: true, force: true})
  })

  test('honours gitignore negation, which hand-parsing got wrong', async () => {
    // `.env*` ignored but `!.env.example` re-included. The old substring
    // parser had no concept of negation.
    const dir = makeApp({})
    git(dir, ['init', '-q', '.'])
    writeFileSync(join(dir, '.gitignore'), '.env*\n!.env.example\n')
    writeFileSync(join(dir, '.env.example'), 'SHOPIFY_API_KEY=placeholder\n')

    const status = await gitStatusFor(dir, '.env.example')
    expect(status.ignored).toBe(false) // negated back in
    rmSync(dir, {recursive: true, force: true})
  })
})

describe('incomplete coverage is reported, not hidden', () => {
  test('records oversized files as skipped instead of silently dropping them', async () => {
    const dir = makeApp({'huge.js': `// pad\n${'x'.repeat(600_000)}\n`})
    const result = await scan(dir)
    expect(result.scan.files_skipped_count).toBeGreaterThan(0)
    const skipped = result.scan.files_skipped ?? []
    expect(skipped.some((f) => f.path.endsWith('huge.js') && f.reason === 'too_large')).toBe(true)
    rmSync(dir, {recursive: true, force: true})
  })

  test('reports zero skipped files for a fully-scanned app', async () => {
    const dir = makeApp({'small.js': 'const a = 1;\n'})
    const result = await scan(dir)
    expect(result.scan.files_skipped_count).toBe(0)
    rmSync(dir, {recursive: true, force: true})
  })
})

/** Probe strings with realistic shape, assembled at runtime. See note above. */
function probeFor(name: string): string | undefined {
  switch (name) {
    case 'Shopify API key':
      return `api_key = "${HEX32}"`
    case 'Shopify API secret':
      return `api_secret = "${PROBES.shopifySecret}"`
    case 'Shopify access token':
      return `access_token = "${PROBES.shopifyToken}"`
    case 'Shopify token':
      return `x = ${PROBES.shopifyToken}`
    case 'Stripe API key':
      return `x = ${PROBES.stripeLive}`
    case 'AWS access key':
      return `x = ${PROBES.awsAccessKey}`
    case 'AWS secret access key':
      return `aws_secret_access_key = "${PROBES.awsSecretKey}"`
    case 'GitHub token':
      return `x = ${PROBES.githubToken}`
    case 'Google API key':
      return `x = ${PROBES.googleKey}`
    case 'Slack token':
      return `x = ${PROBES.slackToken}`
    case 'private key':
      return PROBES.pemHeader
    default:
      return undefined
  }
}

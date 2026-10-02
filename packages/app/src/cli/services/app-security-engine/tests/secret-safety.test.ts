/* eslint-disable id-length, line-comment-position, no-restricted-imports -- security fixtures exercise raw git and filesystem behavior */
import {git, isolateGitConfig} from './git-test-helpers.js'
import {scanDirectory as scan} from './scan-directory.js'
import {
  SHOPIFY_SECRET_PATTERNS,
  redactMatch,
  redactText,
  gitStatusFor,
  scanCommittedSecrets,
} from '../rules/secret-rules.js'
import {afterEach, beforeEach, describe, expect, test} from 'vitest'
import {mkdtempSync, writeFileSync, mkdirSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

/**
 * Regression tests for two defects found in review, both of which the existing
 * suite and the eval gate passed cleanly:
 *
 *   1. The secret scanner printed detected AWS keys verbatim into the console
 *      AND into the deterministic findings stored in .shopify/app-security/.
 *      Detection patterns and redaction patterns were two independent lists,
 *      and they drifted.
 *
 *   2. A .env that was committed and only afterwards added to .gitignore was
 *      downgraded from high to medium, because the rule inferred "not
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
  stripePublishable: compose('pk_', `live_51H8xQ2eZvKYlo2C${ALNUM.slice(0, 24)}`),
  shopifyToken: compose('shp', `at_${HEX32}`),
  shopifySecret: compose('shp', `ss_${HEX32}`),
  githubToken: compose('gh', `p_${ALNUM.repeat(2).slice(0, 36)}`),
  googleKey: compose('AIza', `Sy${ALNUM.repeat(2).slice(0, 33)}`),
  slackToken: compose('xox', `b-123456789012-${ALNUM.slice(0, 16)}`),
  pemHeader: compose('-----BEGIN ', 'RSA PRIVATE KEY-----'),
}

const trackedEnvSecret = () => `SHOPIFY_API_SECRET=${PROBES.shopifySecret}\n`

const TOML = `name = "t"
client_id = "abc123"
application_url = "https://example.com"
[access_scopes]
scopes = "read_orders"
[webhooks]
api_version = "2025-01"
`

const makeApp = (files: Record<string, string>): string => {
  const dir = mkdtempSync(join(tmpdir(), 'app-security-secret-'))
  writeFileSync(join(dir, 'shopify.app.toml'), TOML)
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path)
    mkdirSync(join(full, '..'), {recursive: true})
    writeFileSync(full, content)
  }
  return dir
}

const temporaryDirectories: string[] = []
const removeAfterTest = (directory: string): string => {
  temporaryDirectories.push(directory)
  return directory
}

let restoreGitConfig: (() => void) | undefined
beforeEach(() => {
  restoreGitConfig = isolateGitConfig()
})
afterEach(() => {
  restoreGitConfig?.()
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, {recursive: true, force: true})
})

describe('redaction never emits known secrets', () => {
  const samples: [label: string, line: string, secret: string][] = [
    ['AWS access key', `const k = "${PROBES.awsAccessKey}";`, PROBES.awsAccessKey],
    ['AWS secret access key', `aws_secret_access_key = "${PROBES.awsSecretKey}"`, PROBES.awsSecretKey],
    ['Stripe API key', `const k = "${PROBES.stripeLive}";`, PROBES.stripeLive],
    ['Shopify token', `const k = "${PROBES.shopifyToken}";`, PROBES.shopifyToken],
    ['GitHub token', `const k = "${PROBES.githubToken}";`, PROBES.githubToken],
    ['Google API key', `const k = "${PROBES.googleKey}";`, PROBES.googleKey],
    ['Slack token', `const k = "${PROBES.slackToken}";`, PROBES.slackToken],
  ]

  for (const [label, line, secret] of samples) {
    test(`redacts ${label} in the snippet`, () => {
      const redacted = redactText(line)
      expect(redacted).not.toContain(secret)
      expect(redacted).toContain('REDACTED')
    })
  }

  test('every detection pattern has working redaction — no drift between the two', () => {
    const probe = `x = ${PROBES.shopifyToken}`
    for (const pattern of SHOPIFY_SECRET_PATTERNS) {
      expect(pattern.regex.test(probe), `${pattern.name} has no matching probe`).toBe(true)
      const match = pattern.regex.exec(probe)!
      const secret = pattern.wholeMatch ? match[0] : match[1]
      expect(redactMatch(probe, pattern), `${pattern.name} has no effective redaction`).not.toContain(secret)
    }
  })

  test('redacts an entire multiline private key block including its body and footer', () => {
    const keyBody = compose('base64-key-body-', 'must-never-leak')
    const footer = compose('-----END ', 'RSA PRIVATE KEY-----')
    const block = `${PROBES.pemHeader}\n${keyBody}\n${footer}`
    const redacted = redactText(`reasoning before\n${block}\nevidence after`)

    expect(redacted).not.toContain(PROBES.pemHeader)
    expect(redacted).not.toContain(keyBody)
    expect(redacted).not.toContain(footer)
    expect(redacted).toContain('REDACTED')
    expect(redacted).toContain('reasoning before')
    expect(redacted).toContain('evidence after')
  })

  test('redacts an entire line after a private-key header, including a truncated same-line body', () => {
    const keyBody = compose('base64-key-body-', 'must-never-leak')
    const malformedKey = `${PROBES.pemHeader}${keyBody}`
    const redacted = redactText(malformedKey)

    expect(redacted).toBe('[REDACTED LINE]')
    expect(redacted).not.toContain(keyBody)
  })

  test('does not leak a detected secret into the stored deterministic findings', async () => {
    const dir = makeApp({
      'config.js': `const shopifyToken = "${PROBES.shopifyToken}";\n`,
    })
    const result = await scan(dir)
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain(PROBES.shopifyToken)
    expect(serialized).toContain('REDACTED')
    rmSync(dir, {recursive: true, force: true})
  })
})

describe('git status drives severity, not .gitignore text', () => {
  test('keeps a tracked .env high severity even when it is listed in .gitignore', async () => {
    // The classic leak: commit the file, then gitignore it and assume safety.
    const dir = makeApp({})
    git(dir, ['init', '-q', '.'])
    writeFileSync(join(dir, '.env'), trackedEnvSecret())
    git(dir, ['add', '-f', '.env'])
    git(dir, ['commit', '-qm', 'oops'])
    writeFileSync(join(dir, '.gitignore'), '.env\n')

    expect(git(dir, ['ls-files', '.env']).trim()).toBe('.env') // still tracked

    const result = await scan(dir)
    const finding = result.issues.find((i) => i.id === 'COMMITTED_SECRET')
    expect(finding).toBeDefined()
    expect(finding!.severity).toBe('high')
    expect(finding!.points).toBe(-50)
    expect(finding!.detection_evidence?.join(' ')).toContain('TRACKED')
    expect(finding!.pattern_id).toBe('environment-file:tracked')
    rmSync(dir, {recursive: true, force: true})
  })

  test('does not score a file git confirms is untracked AND ignored', async () => {
    const dir = makeApp({})
    git(dir, ['init', '-q', '.'])
    writeFileSync(join(dir, '.gitignore'), '.env\n')
    git(dir, ['add', '.gitignore'])
    git(dir, ['commit', '-qm', 'init'])
    writeFileSync(join(dir, '.env'), trackedEnvSecret())

    const result = await scan(dir)
    const finding = result.issues.find((i) => i.id === 'COMMITTED_SECRET')
    expect(finding).toBeUndefined()
    rmSync(dir, {recursive: true, force: true})
  })

  test('does not score an empty environment file', async () => {
    const dir = makeApp({'.env': ''})
    const result = await scan(dir)
    expect(result.issues.find((issue) => issue.id === 'COMMITTED_SECRET')).toBeUndefined()
    rmSync(dir, {recursive: true, force: true})
  })

  test('does not score an ignored untracked named secret file', async () => {
    const dir = makeApp({'.gitignore': 'credentials.json\n', 'credentials.json': '{}\n'})
    git(dir, ['init', '-q', '.'])
    const result = await scan(dir)
    expect(result.issues.find((issue) => issue.id === 'COMMITTED_SECRET')).toBeUndefined()
    rmSync(dir, {recursive: true, force: true})
  })

  test('does not score an empty named secret file when git status is unknown', async () => {
    const dir = makeApp({'secrets.json': ''})
    const result = await scan(dir)
    expect(result.issues.find((issue) => issue.id === 'COMMITTED_SECRET')).toBeUndefined()
    rmSync(dir, {recursive: true, force: true})
  })

  test('fails closed for an empty named secret file that git confirms is tracked', async () => {
    const dir = makeApp({})
    git(dir, ['init', '-q', '.'])
    writeFileSync(join(dir, 'secrets.json'), '')
    git(dir, ['add', 'secrets.json', 'shopify.app.toml'])
    git(dir, ['commit', '-qm', 'init'])

    const result = await scan(dir)
    const finding = result.issues.find((issue) => issue.id === 'COMMITTED_SECRET')
    expect(finding).toMatchObject({
      severity: 'high',
      location: {file: 'secrets.json'},
      title: 'Secret file is tracked by git',
    })
    rmSync(dir, {recursive: true, force: true})
  })

  test('does not score placeholder env values when git cannot answer', async () => {
    const dir = makeApp({})
    writeFileSync(join(dir, '.env'), 'SHOPIFY_API_SECRET=placeholder-value-here\n')
    writeFileSync(join(dir, '.gitignore'), '.env\n')

    const result = await scan(dir)
    expect(result.issues.find((i) => i.id === 'COMMITTED_SECRET')).toBeUndefined()
    rmSync(dir, {recursive: true, force: true})
  })

  test('reports unverified exposure separately from confirmed tracked files', async () => {
    const dir = makeApp({})
    writeFileSync(join(dir, '.env'), trackedEnvSecret())

    const result = await scan(dir)
    const finding = result.issues.find((i) => i.id === 'COMMITTED_SECRET')
    expect(finding).toMatchObject({
      severity: 'high',
      points: -50,
      title: 'Environment file with secrets could not be confirmed as ignored',
      pattern_id: 'environment-file:unconfirmed',
    })
    expect(finding!.message).not.toContain('IS TRACKED BY GIT')
    rmSync(dir, {recursive: true, force: true})
  })

  test('does not scan an untracked secret in an app directory that its repository ignores', async () => {
    const repository = removeAfterTest(mkdtempSync(join(tmpdir(), 'app-security-enclosing-')))
    git(repository, ['init', '-q', '.'])
    writeFileSync(join(repository, '.gitignore'), 'apps/\n')
    const dir = join(repository, 'apps', 'web')
    mkdirSync(dir, {recursive: true})
    writeFileSync(join(dir, 'shopify.app.toml'), TOML)
    writeFileSync(join(dir, '.env'), trackedEnvSecret())

    const result = await scan(dir)
    expect(result.issues.filter((i) => i.id === 'COMMITTED_SECRET')).toEqual([])
    expect(result.ignoredScanDirectories).toEqual([dir])
  })

  test('does not report an untracked secret that git ignores when --no-git-ignore scans it', async () => {
    const repository = removeAfterTest(mkdtempSync(join(tmpdir(), 'app-security-enclosing-')))
    git(repository, ['init', '-q', '.'])
    writeFileSync(join(repository, '.gitignore'), 'apps/\n')
    const dir = join(repository, 'apps', 'web')
    mkdirSync(dir, {recursive: true})
    writeFileSync(join(dir, 'shopify.app.toml'), TOML)
    writeFileSync(join(dir, '.env'), trackedEnvSecret())

    const result = await scan(dir, undefined, {noGitIgnore: true})
    expect(result.issues.filter((i) => i.id === 'COMMITTED_SECRET')).toEqual([])
    expect(result.ignoredScanDirectories).toEqual([])
  })

  test('with --no-git-ignore, skips an untracked ignored .env and reports the same .env once force-added', async () => {
    const dir = removeAfterTest(makeApp({'.gitignore': '.env\n', '.env': trackedEnvSecret()}))
    git(dir, ['init', '-q', '.'])

    const untracked = await scan(dir, undefined, {noGitIgnore: true})
    expect(untracked.issues.filter((i) => i.id === 'COMMITTED_SECRET')).toEqual([])

    git(dir, ['add', '-f', '.env'])
    const tracked = await scan(dir, undefined, {noGitIgnore: true})
    expect(tracked.issues.find((i) => i.id === 'COMMITTED_SECRET')).toMatchObject({
      location: {file: '.env'},
      title: 'Environment file with secrets is tracked by git',
      pattern_id: 'environment-file:tracked',
    })
  })

  test('with --no-git-ignore, still reports an untracked .env that git does not ignore', async () => {
    const dir = removeAfterTest(makeApp({'.env': trackedEnvSecret()}))
    git(dir, ['init', '-q', '.'])

    const result = await scan(dir, undefined, {noGitIgnore: true})
    expect(result.issues.find((i) => i.id === 'COMMITTED_SECRET')).toMatchObject({
      location: {file: '.env'},
      title: 'Environment file with secrets is not ignored by git',
    })
  })

  test("judges a secret inside a nested repository by that repository's rules, not the app repository's", async () => {
    const dir = removeAfterTest(makeApp({'.gitignore': '.env\n'}))
    git(dir, ['init', '-q', '.'])
    const inner = join(dir, 'inner')
    mkdirSync(inner)
    git(inner, ['init', '-q', '.'])
    writeFileSync(join(inner, '.env'), trackedEnvSecret())

    const result = await scan(dir)
    const finding = result.issues.find((i) => i.id === 'COMMITTED_SECRET')
    expect(finding).toMatchObject({
      location: {file: 'inner/.env'},
      title: 'Environment file with secrets is not ignored by git',
      pattern_id: 'environment-file:unconfirmed',
    })
    expect(finding!.message).toContain('inner/.env is untracked but not ignored')
    expect(finding!.detection_evidence).toContain('git check-ignore -q inner/.env → not ignored')
  })

  test('says the ignored-file listing failed when git ignores a file that was still scanned', async () => {
    const dir = removeAfterTest(makeApp({'.gitignore': '.env\n', '.env': trackedEnvSecret()}))
    git(dir, ['init', '-q', '.'])
    const file = {path: '.env', absolutePath: join(dir, '.env'), ext: '', content: trackedEnvSecret()}

    const issues = await scanCommittedSecrets([file], dir, 'failed')
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      location: {file: '.env'},
      title: 'Environment file with secrets is ignored by git but was scanned',
      pattern_id: 'environment-file:unconfirmed',
    })
    expect(issues[0]!.message).toContain('could not list the ignored files')
    expect(issues[0]!.detection_evidence?.join(' ')).toContain('→ ignored')
  })

  test('still scans a gitignored secret conservatively when git cannot list the ignored files', async () => {
    // A truncated index makes `ls-files` fail while `rev-parse` still works.
    const dir = removeAfterTest(makeApp({'.gitignore': '.env\n', '.env': trackedEnvSecret()}))
    git(dir, ['init', '-q', '.'])
    git(dir, ['add', '.gitignore', 'shopify.app.toml'])
    git(dir, ['commit', '-qm', 'init'])
    writeFileSync(join(dir, '.git', 'index'), 'not an index')

    const result = await scan(dir)
    const finding = result.issues.find((issue) => issue.id === 'COMMITTED_SECRET')
    expect(finding).toMatchObject({
      severity: 'high',
      points: -50,
      location: {file: '.env'},
      title: 'Environment file with secrets could not be confirmed as ignored',
      pattern_id: 'environment-file:unconfirmed',
    })
    expect(finding!.message).toContain('git status command failed')
    expect(JSON.stringify(result)).not.toContain(PROBES.shopifySecret)
  })

  test('says why is unknown when an ignored file has the same top level as the app', async () => {
    const dir = removeAfterTest(makeApp({'.gitignore': '.env\n', '.env': trackedEnvSecret()}))
    git(dir, ['init', '-q', '.'])
    const file = {path: '.env', absolutePath: join(dir, '.env'), ext: '', content: trackedEnvSecret()}

    const issues = await scanCommittedSecrets([file], dir, 'listed')
    expect(issues[0]).toMatchObject({
      title: 'Environment file with secrets is ignored by git but was scanned',
      pattern_id: 'environment-file:unconfirmed',
    })
    expect(issues[0]!.message).toContain(
      ".env is ignored by git but was still scanned; App Security couldn't determine why",
    )
    expect(issues[0]!.message).not.toContain('could not be confirmed')
    expect(issues[0]!.detection_evidence?.join(' ')).toContain('git rev-parse --show-toplevel → same')
  })

  test('reports tri-state status rather than a boolean guess', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'app-security-nogit-'))
    const status = await gitStatusFor({path: '.env', absolutePath: join(dir, '.env')})
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

    const status = await gitStatusFor({path: '.env.example', absolutePath: join(dir, '.env.example')})
    expect(status.ignored).toBe(false) // negated back in
    rmSync(dir, {recursive: true, force: true})
  })
})

describe('committed secret classification', () => {
  test('detects every supported Shopify credential prefix as a bare value', () => {
    const prefixes = ['shpat_', 'shpca_', 'shppa_', 'shpss_', 'shprt_', 'shpsb_', 'shptka_', 'shpua_']
    for (const prefix of prefixes) {
      const token = compose(prefix, HEX32)
      expect(
        SHOPIFY_SECRET_PATTERNS.some((pattern) => pattern.regex.test(token)),
        `${prefix} not detected`,
      ).toBe(true)
    }
  })

  test('does not score template env files with placeholder values', async () => {
    const dir = makeApp({
      '.env.example': 'SHOPIFY_API_SECRET=your-secret-here\nSHOPIFY_API_KEY=your-key-here\n',
    })
    git(dir, ['init', '-q', '.'])
    git(dir, ['add', '.'])
    git(dir, ['commit', '-qm', 'init'])

    const result = await scan(dir)
    expect(result.issues.filter((issue) => issue.id === 'COMMITTED_SECRET')).toEqual([])
    rmSync(dir, {recursive: true, force: true})
  })

  test('scores a real token format in a template env file', async () => {
    const dir = makeApp({'.env.example': trackedEnvSecret()})
    git(dir, ['init', '-q', '.'])
    git(dir, ['add', '.'])
    git(dir, ['commit', '-qm', 'init'])

    const result = await scan(dir)
    expect(result.issues.find((issue) => issue.id === 'COMMITTED_SECRET')).toMatchObject({
      severity: 'high',
      location: {file: '.env.example'},
    })
    rmSync(dir, {recursive: true, force: true})
  })

  test('does not score public Shopify API keys in env files', async () => {
    const dir = makeApp({'.env': `SHOPIFY_API_KEY=${HEX32}\n`})
    git(dir, ['init', '-q', '.'])
    git(dir, ['add', '-f', '.env'])
    git(dir, ['commit', '-qm', 'init'])

    const result = await scan(dir)
    expect(result.issues.filter((issue) => issue.id === 'COMMITTED_SECRET')).toEqual([])
    rmSync(dir, {recursive: true, force: true})
  })

  test('does not score placeholder assignments in a tracked .env', async () => {
    const dir = makeApp({'.env': 'SHOPIFY_API_SECRET=placeholder-value-here\npassword=changeme\n'})
    git(dir, ['init', '-q', '.'])
    git(dir, ['add', '-f', '.env'])
    git(dir, ['commit', '-qm', 'init'])

    const result = await scan(dir)
    expect(result.issues.filter((issue) => issue.id === 'COMMITTED_SECRET')).toEqual([])
    rmSync(dir, {recursive: true, force: true})
  })

  test('scores a real token format in a multi-suffix template env file', async () => {
    const dir = makeApp({'.env.local.example': trackedEnvSecret()})
    git(dir, ['init', '-q', '.'])
    git(dir, ['add', '.'])
    git(dir, ['commit', '-qm', 'init'])

    const result = await scan(dir)
    expect(result.issues.find((issue) => issue.id === 'COMMITTED_SECRET')).toMatchObject({
      severity: 'high',
      location: {file: '.env.local.example'},
    })
    rmSync(dir, {recursive: true, force: true})
  })

  test('does not score a value identified only by a secret-sounding key name', async () => {
    // Key names are not evidence: `password` in JSON could be anything, and
    // flagging it is what flooded partners with false positives.
    const dir = makeApp({'secrets.json': '{ "password": "correct-horse-battery-staple" }\n'})
    git(dir, ['init', '-q', '.'])
    git(dir, ['add', '.'])
    git(dir, ['commit', '-qm', 'init'])

    const result = await scan(dir)
    expect(result.issues.filter((issue) => issue.id === 'COMMITTED_SECRET')).toEqual([])
    rmSync(dir, {recursive: true, force: true})
  })

  test('does not score quoted JSON placeholder assignments in a tracked named secret file', async () => {
    const dir = makeApp({'secrets.json': '{ "password": "changeme" }\n'})
    git(dir, ['init', '-q', '.'])
    git(dir, ['add', '.'])
    git(dir, ['commit', '-qm', 'init'])

    const result = await scan(dir)
    expect(result.issues.filter((issue) => issue.id === 'COMMITTED_SECRET')).toEqual([])
    rmSync(dir, {recursive: true, force: true})
  })

  test('does not score a 32-hex value under a secret-sounding name, quoted or not', async () => {
    // Legacy Shopify API secrets are 32 hex chars, but so are client IDs,
    // webhook ids, and content hashes — without a prefix the value is not
    // provably a secret.
    for (const assignment of [`SHOPIFY_API_SECRET="${HEX32}"\n`, `SHOPIFY_API_SECRET=${HEX32}\n`]) {
      const dir = makeApp({'.env': assignment})
      git(dir, ['init', '-q', '.'])
      git(dir, ['add', '-f', '.env'])
      git(dir, ['commit', '-qm', 'init'])

      // eslint-disable-next-line no-await-in-loop
      const result = await scan(dir)
      expect(result.issues.filter((issue) => issue.id === 'COMMITTED_SECRET')).toEqual([])
      rmSync(dir, {recursive: true, force: true})
    }
  })

  test('scores a prefixed Shopify token in source regardless of variable name', async () => {
    const dir = makeApp({'config.js': `const token = "${PROBES.shopifySecret}"\n`})
    const result = await scan(dir)
    expect(result.issues.find((issue) => issue.id === 'COMMITTED_SECRET')).toMatchObject({
      severity: 'high',
      location: {file: 'config.js'},
    })
    rmSync(dir, {recursive: true, force: true})
  })

  test('does not score a 32-hex value under a secret-sounding name in source', async () => {
    const dir = makeApp({'config.js': `SHOPIFY_API_SECRET=${HEX32}\n`})
    const result = await scan(dir)
    expect(result.issues.filter((issue) => issue.id === 'COMMITTED_SECRET')).toEqual([])
    rmSync(dir, {recursive: true, force: true})
  })

  test('does not treat a blank secret assignment as the next line', async () => {
    const dir = makeApp({'.env': 'SHOPIFY_API_SECRET=\nPORT=3000\n'})
    git(dir, ['init', '-q', '.'])
    git(dir, ['add', '-f', '.env'])
    git(dir, ['commit', '-qm', 'init'])

    const result = await scan(dir)
    expect(result.issues.filter((issue) => issue.id === 'COMMITTED_SECRET')).toEqual([])
    rmSync(dir, {recursive: true, force: true})
  })

  test('does not score boolean flags whose names merely contain password', async () => {
    const dir = makeApp({'.env': 'HAS_PASSWORD=true\n'})
    git(dir, ['init', '-q', '.'])
    git(dir, ['add', '-f', '.env'])
    git(dir, ['commit', '-qm', 'init'])

    const result = await scan(dir)
    expect(result.issues.filter((issue) => issue.id === 'COMMITTED_SECRET')).toEqual([])
    rmSync(dir, {recursive: true, force: true})
  })

  test('does not score non-Shopify credential formats', async () => {
    const credentials = [
      `STRIPE_SECRET=${PROBES.stripeLive}`,
      `STRIPE_PUBLIC_KEY=${PROBES.stripePublishable}`,
      `AWS_ACCESS_KEY_ID=${PROBES.awsAccessKey}`,
      `aws_secret_access_key="${PROBES.awsSecretKey}"`,
      `GITHUB_TOKEN=${PROBES.githubToken}`,
      `GOOGLE_API_KEY=${PROBES.googleKey}`,
      `SLACK_TOKEN=${PROBES.slackToken}`,
      PROBES.pemHeader,
    ].join('\n')
    const dir = makeApp({'.env': `${credentials}\n`, 'config.js': `${credentials}\n`})

    const result = await scan(dir)
    expect(result.issues.filter((issue) => issue.id === 'COMMITTED_SECRET')).toEqual([])
    rmSync(dir, {recursive: true, force: true})
  })
})

describe('secret evidence coverage', () => {
  test('scans common repository text formats and unsupported source languages', async () => {
    const files = {
      'README.md': PROBES.shopifyToken,
      'config/settings.yaml': PROBES.shopifyToken,
      'config/settings.json': PROBES.shopifyToken,
      'config/settings.toml': PROBES.shopifyToken,
      'prisma/schema.prisma': PROBES.shopifyToken,
      'scripts/setup.sh': PROBES.shopifyToken,
      'server/app.rb': PROBES.shopifyToken,
    }
    const dir = makeApp(files)
    const result = await scan(dir)
    const findings = result.issues.filter((issue) => issue.id === 'COMMITTED_SECRET')

    for (const path of Object.keys(files)) expect(findings.some((finding) => finding.location.file === path)).toBe(true)
    expect(JSON.stringify(result)).not.toContain(PROBES.shopifyToken)
    rmSync(dir, {recursive: true, force: true})
  })

  test('excludes binary content', async () => {
    const dir = makeApp({
      'binary.json': `\0${PROBES.shopifyToken}`,
    })
    const result = await scan(dir)
    expect(result.issues.filter((issue) => issue.id === 'COMMITTED_SECRET')).toEqual([])
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

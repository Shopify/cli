import {scanDirectory as scan} from './scan-directory.js'
import {formatJson} from '../output/format.js'
import {combineFindings} from '../results/combine.js'
import {MAX_EXCERPT_LINE_LENGTH, withoutCodeExcerpts} from '../results/code-excerpt.js'
import {translateFindingsDocument} from '../results/translate.js'
import {RULE_CATALOG} from '../rules/catalog.js'
import {activeScanIssues, buildDeterministicFindings as buildFindings} from '../scan-artifact/index.js'
import {inTemporaryDirectory, symlink, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import type {BuildDeterministicFindingsOptions} from '../scan-artifact/index.js'
import type {SuppressionEntry} from '../results/suppressions.js'
import type {CheckExecution, DeterministicFindingsDocument, Issue, ScanResult} from '../types.js'

function buildDeterministicFindings(scanResult: ScanResult, options: Partial<BuildDeterministicFindingsOptions> = {}) {
  return buildFindings(scanResult, {
    scope: {include_dirs: [], excludes: [], no_git_ignore: false},
    scanDirectories: [{directory: '.', origin: 'app_directory'}],
    ...options,
  })
}

const execution = (overrides: Partial<CheckExecution> = {}): CheckExecution => ({
  id: 'CREDENTIAL_LOG_LEAKAGE',
  version: 1,
  kind: 'deterministic',
  status: 'executed',
  applicable: true,
  languages: ['typescript'],
  framework: 'react_router',
  surface: 'react_router',
  inspected_files: ['app/a.ts'],
  findings: 0,
  analysis_mode: 'regex',
  ...overrides,
})

const result = (issues: Issue[] = [], checksExecuted: CheckExecution[] = [execution()]): ScanResult => ({
  version: '0.1.0',
  timestamp: '2026-08-28T00:00:00.000Z',
  app: {name: 'scan-artifact-test', type: 'public'},
  detection: {
    framework: 'react_router',
    surface: 'react_router',
    languages: [{name: 'typescript', support: 'supported', files: ['app/a.ts']}],
  },
  capabilities: {
    theme_app_extension: false,
    app_embed: false,
    embedded_app: false,
    script_tags: false,
    webhooks: false,
    app_proxy: false,
    storefront_metafield_writes: false,
    has_backend: true,
    declared_ip_allowlist: false,
    checkout_extension: false,
  },
  scan: {
    timestamp: '2026-08-28T00:00:00.000Z',
    security_version: '0.1.0',
    files_scanned: 1,
    rules_run: 1,
    rules_skipped: 0,
    files_skipped_count: 0,
    coverage_gaps: [],
    checks_executed: checksExecuted.map((check) => ({
      ...check,
      findings: issues.filter((issue) => issue.id === check.id).length,
    })),
  },
  issues,
})

const deterministicIssue = (overrides: Partial<Issue> = {}): Issue => ({
  id: 'CREDENTIAL_LOG_LEAKAGE',
  rule_version: 1,
  severity: 'high',
  points: -20,
  title: 'Token logged',
  message: 'A token is logged',
  location: {file: 'app/a.ts', line: 2},
  evidence: [{location: {file: 'app/a.ts', line: 2}, quote: 'console.log(token)'}],
  snippet: 'console.log(token)',
  fix: {automated: false, description: 'Remove it'},
  ...overrides,
})

const catalogEntry = (id: string) => RULE_CATALOG.find((entry) => entry.id === id)!

describe('buildDeterministicFindings', () => {
  test('builds the exact deterministic document, with findings nested under their check', () => {
    const document = buildDeterministicFindings(result([deterministicIssue()]), {
      generatedAt: '2026-08-28T00:00:00.000Z',
    })

    expect(document).toEqual({
      schema_version: 1,
      source: 'deterministic',
      engine: {name: 'shopify-app-security', version: '0.1.0', ruleset: 'app-security-rules@0.1.0'},
      generated_at: '2026-08-28T00:00:00.000Z',
      detection: {
        framework: 'react_router',
        surface: 'react_router',
        languages: [{name: 'typescript', support: 'supported', files: ['app/a.ts']}],
      },
      coverage: {
        files_scanned: 1,
        files_skipped: [],
        gaps: [],
        scope: {include_dirs: [], excludes: [], no_git_ignore: false},
        scan_directories: [{directory: '.', origin: 'app_directory'}],
      },
      checks: [
        {
          id: 'CREDENTIAL_LOG_LEAKAGE',
          version: 1,
          status: 'executed',
          analysis_mode: 'regex',
          snapshot: {
            title: 'Credential reaches a log sink',
            severity: 'high',
            description: 'Detects direct credential flows to console and logger sinks.',
            docs_url: 'https://shopify.dev/docs/apps/build/security/app-security-checks/credential-log-leakage',
            current_version: 1,
          },
          findings: [
            {
              location: {file: 'app/a.ts', line: 2},
              message: 'A token is logged',
              evidence: [{location: {file: 'app/a.ts', line: 2}, quote: 'console.log(token)'}],
              snippet: 'console.log(token)',
              fix: {automated: false, description: 'Remove it'},
            },
          ],
        },
      ],
    })
    expect(translateFindingsDocument(JSON.parse(JSON.stringify(document)))).toEqual({ok: true, document})
  })

  test('records the scope as typed and the scan directories in coverage', () => {
    const scope = {include_dirs: ['../backend', './lib/'], excludes: ['generated', '**/*.log'], no_git_ignore: true}
    const scanDirectories = [
      {directory: '.', origin: 'app_directory' as const},
      {directory: '../backend', origin: 'include_dir' as const},
    ]

    const document = buildDeterministicFindings(result(), {scope, scanDirectories})

    expect(document.coverage.scope).toEqual(scope)
    expect(document.coverage.scan_directories).toEqual(scanDirectories)
    expect(translateFindingsDocument(JSON.parse(JSON.stringify(document)))).toEqual({ok: true, document})
  })

  test('redacts secrets in the scope and the scan directories', () => {
    const secret = `shpat_${'a'.repeat(24)}`
    const scope = {include_dirs: [`../${secret}`], excludes: [`${secret}/**`], no_git_ignore: false}
    const scanDirectories = [{directory: `../${secret}`, origin: 'include_dir' as const}]

    const document = buildDeterministicFindings(result(), {scope, scanDirectories})

    expect(JSON.stringify(document.coverage)).not.toContain(secret)
    expect(document.coverage.scope.include_dirs[0]).toMatch(/^\.\.\/.*\[REDACTED/)
  })

  test('snapshots the catalog, not the per-finding severity and title', () => {
    const document = buildDeterministicFindings(
      result(
        [deterministicIssue({id: 'EOL_API_VERSION', severity: 'high', title: 'Wrong title'})],
        [execution({id: 'EOL_API_VERSION', analysis_mode: 'structured_config'})],
      ),
    )
    const entry = catalogEntry('EOL_API_VERSION')

    expect(document.checks[0]!.snapshot).toEqual({
      title: entry.title,
      severity: 'low',
      description: entry.description,
      guide: entry.guide,
      docs_url: entry.docsUrl,
      current_version: 1,
    })
    expect(document.checks[0]!.findings[0]).not.toHaveProperty('severity')
    expect(document.checks[0]!.findings[0]).not.toHaveProperty('title')
  })

  test('keeps the per-finding fix, including its guide', () => {
    const fix = {automated: true, description: 'Use textContent', guide: 'https://example.com/guide'}
    const document = buildDeterministicFindings(result([deterministicIssue({fix})]))

    expect(document.checks[0]!.findings[0]!.fix).toEqual(fix)
  })

  test('sorts checks by id and each check’s findings by file, line, and message', () => {
    const document = buildDeterministicFindings(
      result(
        [
          deterministicIssue({location: {file: 'app/b.ts', line: 1}}),
          deterministicIssue({location: {file: 'app/a.ts', line: 10}}),
          deterministicIssue({location: {file: 'app/a.ts', line: 9}, message: 'second'}),
          deterministicIssue({location: {file: 'app/a.ts', line: 9}, message: 'first'}),
          deterministicIssue({id: 'COMMITTED_SECRET', location: {file: 'zzz.env'}}),
        ],
        [execution({id: 'CREDENTIAL_LOG_LEAKAGE'}), execution({id: 'COMMITTED_SECRET'})],
      ),
    )

    expect(document.checks.map((check) => check.id)).toEqual(['COMMITTED_SECRET', 'CREDENTIAL_LOG_LEAKAGE'])
    expect(
      document.checks[1]!.findings.map(
        (finding) => `${finding.location.file}:${finding.location.line}:${finding.message}`,
      ),
    ).toEqual([
      'app/a.ts:9:first',
      'app/a.ts:9:second',
      'app/a.ts:10:A token is logged',
      'app/b.ts:1:A token is logged',
    ])
  })

  test('orders findings in code-point order, the same order the combiner uses', () => {
    const document = buildDeterministicFindings(
      result([
        deterministicIssue({location: {file: 'app/a.ts', line: 1}}),
        deterministicIssue({location: {file: 'app/a', line: 1}}),
        deterministicIssue({location: {file: 'app/a'}}),
        deterministicIssue({location: {file: 'app/_.ts', line: 1}}),
      ]),
    )
    const locations = (findings: {location: {file: string; line?: number}}[]) =>
      findings.map((finding) => `${finding.location.file}:${finding.location.line ?? '-'}`)

    expect(locations(document.checks[0]!.findings)).toEqual(['app/_.ts:1', 'app/a:-', 'app/a:1', 'app/a.ts:1'])
    const [combined] = combineFindings({deterministic: document, agent: null}).checks
    expect(locations(combined!.findings)).toEqual(locations(document.checks[0]!.findings))
  })

  test('maps unsupported_framework to unresolved and drops applicable and the findings count', () => {
    const document = buildDeterministicFindings(
      result(
        [],
        [
          execution({
            status: 'unsupported_framework',
            applicable: true,
            reason: {code: 'unsupported_framework', message: 'Needs React Router.'},
          }),
          execution({
            id: 'EOL_API_VERSION',
            status: 'not_applicable',
            applicable: false,
            reason: {code: 'no_relevant_files', message: 'No config.'},
          }),
        ],
      ),
    )

    expect(document.checks.map((check) => [check.id, check.status, check.reason])).toEqual([
      ['CREDENTIAL_LOG_LEAKAGE', 'unresolved', {code: 'unsupported_framework', message: 'Needs React Router.'}],
      ['EOL_API_VERSION', 'not_applicable', {code: 'no_relevant_files', message: 'No config.'}],
    ])
    for (const check of document.checks) {
      expect(check).not.toHaveProperty('applicable')
      expect(check.findings).toEqual([])
    }
  })

  test('throws when a finding belongs to a check that was not executed', () => {
    expect(() => buildDeterministicFindings(result([deterministicIssue({id: 'COMMITTED_SECRET'})]))).toThrow(
      'COMMITTED_SECRET',
    )
  })

  test('redacts coverage and execution reasons', () => {
    const secret = `shpat_${'a'.repeat(24)}`
    const scanResult = result()
    scanResult.scan.files_skipped = [{path: `app/${secret}.ts`, reason: 'unreadable', detail: `detail ${secret}`}]
    scanResult.scan.coverage_gaps = [
      {code: 'skipped_file', message: `gap ${secret}`, file: `app/${secret}.ts`},
      {code: 'unresolved_check', message: 'Parser failed.', check_id: 'CREDENTIAL_LOG_LEAKAGE'},
    ]
    scanResult.scan.checks_executed[0]!.status = 'unresolved'
    scanResult.scan.checks_executed[0]!.reason = {code: 'parser_unavailable', message: `reason ${secret}`}

    const document = buildDeterministicFindings(scanResult)
    const serialized = JSON.stringify(document)

    expect(serialized).not.toContain(secret)
    expect(serialized).toContain('[REDACTED:')
    expect(document.checks[0]!.reason!.message).toMatch(/REDACTED/)
    expect(document.coverage.gaps).toContainEqual(
      expect.objectContaining({code: 'unresolved_check', check_id: 'CREDENTIAL_LOG_LEAKAGE'}),
    )
  })

  test('fails closed when text contains more secret matches than the work cap', () => {
    const secrets = Array.from({length: 150}, (_, index) => `AKIA${index.toString(36).toUpperCase().padStart(16, 'A')}`)
    const scanResult = result([deterministicIssue({message: secrets.join(' ')})])
    const outputs = [JSON.stringify(buildDeterministicFindings(scanResult)), formatJson(scanResult)]
    for (const output of outputs) {
      for (const secret of secrets) expect(output).not.toContain(secret)
      expect(output).toContain('[REDACTED TEXT]')
    }
  })

  test('redacts complete private key blocks from every free-form finding field', () => {
    const header = ['-----BEGIN RSA', 'PRIVATE KEY-----'].join(' ')
    const body = ['private-key-body', 'must-not-leak'].join('-')
    const footer = ['-----END RSA', 'PRIVATE KEY-----'].join(' ')
    const block = `${header}\n${body}\n${footer}`
    const issue = deterministicIssue({
      message: block,
      snippet: block,
      detection_evidence: [block],
    })
    issue.evidence = [{location: issue.location, quote: block}]

    const serialized = JSON.stringify(buildDeterministicFindings(result([issue])))
    expect(serialized).not.toContain(body)
    expect(serialized).not.toContain(footer)
    expect(serialized).toContain('REDACTED')
  })

  test('redacts matched secrets from every finding output field', () => {
    const secret = `shpat_${'a'.repeat(24)}`
    const issue = deterministicIssue({
      message: `message ${secret}`,
      snippet: `snippet ${secret}`,
      location: {file: `app/${secret}.ts`, line: 2},
      fix: {automated: false, description: `fix ${secret}`, guide: `https://example.com/${secret}`},
    })
    issue.evidence = [{location: {file: `app/${secret}.ts`, line: 2}, quote: `quote ${secret}`}]
    const serialized = JSON.stringify(buildDeterministicFindings(result([issue])))
    expect(serialized).not.toContain(secret)
    expect(serialized).toContain('[REDACTED:')

    const scanResult = result([issue])
    scanResult.app.name = `app ${secret}`
    expect(formatJson(scanResult)).not.toContain(secret)
  })

  test('records skipped inputs from a real scan as coverage gaps and translates back', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(
        joinPath(directory, 'shopify.app.toml'),
        'name = "manifests"\napplication_url = "https://example.com"\n',
      )
      await writeFile(joinPath(directory, 'package.json'), '{invalid')

      const document = buildDeterministicFindings(await scan(directory))

      expect(document.coverage.files_skipped).toContainEqual(
        expect.objectContaining({path: 'package.json', reason: 'unreadable'}),
      )
      expect(document.coverage.gaps).toContainEqual(
        expect.objectContaining({code: 'skipped_file', file: 'package.json'}),
      )
      expect(document.checks.length).toBeGreaterThan(0)
      expect(translateFindingsDocument(JSON.parse(JSON.stringify(document)))).toEqual({ok: true, document})
    })
  })
})

describe('activeScanIssues', () => {
  const entry = (overrides: Partial<SuppressionEntry> = {}): SuppressionEntry => ({
    source: 'deterministic',
    check: 'CREDENTIAL_LOG_LEAKAGE',
    kind: 'false-positive',
    path: 'app/a.ts',
    reason: 'A test fixture.',
    configurations: ['shopify.app.toml'],
    ...overrides,
  })

  /** The checks that `check` combines from the scan's deterministic-findings.json and these entries. */
  function combinedChecks(scanResult: ScanResult, entries: SuppressionEntry[]) {
    return combineFindings({
      deterministic: buildDeterministicFindings(scanResult),
      agent: null,
      suppressions: {entries, resultsKey: 'shopify.app'},
    }).checks
  }

  test('leaves out the issues whose stored findings an entry suppresses, compared in their stored, redacted form', () => {
    const secret = `shpat_${'b'.repeat(24)}`
    const suppressedIssue = deterministicIssue({snippet: `console.log("${secret}")`})
    const otherIssue = deterministicIssue({message: 'Another token is logged', location: {file: 'app/a.ts', line: 7}})
    const otherCheckIssue = deterministicIssue({id: 'COMMITTED_SECRET', location: {file: 'app/a.ts', line: 2}})
    const scanResult = result(
      [suppressedIssue, otherIssue, otherCheckIssue],
      [execution(), execution({id: 'COMMITTED_SECRET'})],
    )

    const checks = combinedChecks(scanResult, [entry({code: 'A token is logged'})])

    expect(activeScanIssues(scanResult.issues, checks)).toEqual([otherIssue, otherCheckIssue])
  })

  test('leaves out identical issues together when a path-level entry suppresses them', () => {
    const scanResult = result([deterministicIssue(), deterministicIssue()])

    expect(activeScanIssues(scanResult.issues, combinedChecks(scanResult, [entry()]))).toEqual([])
  })

  test('keeps every issue when nothing is suppressed', () => {
    const scanResult = result([deterministicIssue(), deterministicIssue({location: {file: 'app/a.ts', line: 7}})])

    expect(activeScanIssues(scanResult.issues, combinedChecks(scanResult, []))).toEqual(scanResult.issues)
    expect(activeScanIssues(scanResult.issues, [])).toEqual(scanResult.issues)
  })
})

describe('code excerpts', () => {
  // Composed at runtime so the literal token never appears in the repository.
  const token = ['shpat', '_', '0123456789abcdef'.repeat(2)].join('')

  const committedSecrets = (document: DeterministicFindingsDocument) =>
    document.checks.find((check) => check.id === 'COMMITTED_SECRET')?.findings ?? []

  async function scanApp(directory: string, files: Record<string, string>) {
    await writeFile(joinPath(directory, 'shopify.app.toml'), 'name = "excerpts"\n')
    await Promise.all(Object.entries(files).map(([path, content]) => writeFile(joinPath(directory, path), content)))
    return buildDeterministicFindings(await scan(directory))
  }

  test('removes both finding and evidence excerpts from deterministic documents', () => {
    const issue = deterministicIssue()
    const original = buildDeterministicFindings(result([issue]))
    const excerpt = [{line: 2, text: 'console.log(token)'}]
    const withExcerpts = buildDeterministicFindings(
      result([
        {...issue, code_excerpt: excerpt, evidence: issue.evidence!.map((item) => ({...item, code_excerpt: excerpt}))},
      ]),
      {generatedAt: original.generated_at},
    )

    expect(withoutCodeExcerpts(withExcerpts)).toEqual(original)
    expect(withExcerpts.checks[0]!.findings[0]!.evidence[0]!.code_excerpt).toEqual(excerpt)
  })

  test.each(['.env', 'secrets.json'])('does not quote a source alias of %s', async (secretFile) => {
    await inTemporaryDirectory(async (directory) => {
      const secret = '0123456789abcdef'.repeat(2)
      await writeFile(joinPath(directory, 'shopify.app.toml'), 'name = "excerpts"\n')
      await writeFile(joinPath(directory, secretFile), `SHOPIFY_API_SECRET=${secret}\nconst token = "${token}"\n`)
      await symlink(joinPath(directory, secretFile), joinPath(directory, 'config.js'))

      const document = buildDeterministicFindings(await scan(directory))

      const findings = committedSecrets(document).filter((finding) => finding.location.file === 'config.js')
      expect(findings).toHaveLength(1)
      expect(findings[0]).not.toHaveProperty('code_excerpt')
      expect(JSON.stringify(document)).not.toContain(secret)
    })
  })

  test('keeps the excerpts of an issue and its evidence, and translates back', () => {
    const issue = deterministicIssue({
      code_excerpt: [
        {line: 1, text: 'const token = session.accessToken'},
        {line: 2, text: 'console.log(token)'},
      ],
      evidence: [
        {
          location: {file: 'app/a.ts', line: 1},
          quote: 'session.accessToken',
          code_excerpt: [{line: 1, text: 'const token = session.accessToken'}],
        },
      ],
    })

    const document = buildDeterministicFindings(result([issue]))

    expect(document.checks[0]!.findings[0]).toMatchObject({
      code_excerpt: issue.code_excerpt,
      evidence: issue.evidence,
    })
    expect(translateFindingsDocument(JSON.parse(JSON.stringify(document)))).toEqual({ok: true, document})
  })

  test('redacts secrets in the excerpts of an issue and its evidence', () => {
    const issue = deterministicIssue({
      code_excerpt: [{line: 2, text: `const token = "${token}"`}],
      evidence: [{location: {file: 'app/a.ts', line: 2}, code_excerpt: [{line: 2, text: token}]}],
    })

    const serialized = JSON.stringify(buildDeterministicFindings(result([issue])))

    expect(serialized).not.toContain(token)
    expect(serialized).toContain('[REDACTED:')
  })

  test('a scan stores the flagged line and up to two lines either side, as the file has them', async () => {
    await inTemporaryDirectory(async (directory) => {
      const document = await scanApp(directory, {
        'config.js': ['// one', '// two', `const token = "${token}"`, '// four', '// five', '// six', ''].join('\r\n'),
        'first.js': [`export const token = "${token}"`, '// two', ''].join('\n'),
      })

      const [config, first] = committedSecrets(document)
      expect(config!.location).toEqual({file: 'config.js', line: 3})
      expect(config!.code_excerpt).toEqual([
        {line: 1, text: '// one'},
        {line: 2, text: '// two'},
        {line: 3, text: expect.stringMatching(/^const token = "shpa\[REDACTED:38\]"$/)},
        {line: 4, text: '// four'},
        {line: 5, text: '// five'},
      ])
      expect(first!.location).toEqual({file: 'first.js', line: 1})
      expect(first!.code_excerpt).toEqual([
        {line: 1, text: expect.stringContaining('[REDACTED:38]')},
        {line: 2, text: '// two'},
      ])
      expect(translateFindingsDocument(JSON.parse(JSON.stringify(document)))).toEqual({ok: true, document})
    })
  })

  test('a scan stores no excerpt for a finding without a line', async () => {
    await inTemporaryDirectory(async (directory) => {
      const document = await scanApp(directory, {'.env': `SHOPIFY_API_SECRET=${token}\n`})

      const [environmentFile] = committedSecrets(document)
      expect(environmentFile!.location).toEqual({file: '.env'})
      expect(environmentFile).not.toHaveProperty('code_excerpt')
    })
  })

  test(`a scan cuts an excerpt line after ${MAX_EXCERPT_LINE_LENGTH} characters, after redacting it`, async () => {
    await inTemporaryDirectory(async (directory) => {
      const padding = 'x'.repeat(MAX_EXCERPT_LINE_LENGTH - 10)
      const document = await scanApp(directory, {'long.js': `${padding}${token}\n`})

      const [long] = committedSecrets(document)
      expect(long!.code_excerpt).toEqual([{line: 1, text: `${padding}shpa[REDAC…`}])
    })
  })
})

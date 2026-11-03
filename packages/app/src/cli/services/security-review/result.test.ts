import {renderSecurityReviewResult} from './result.js'
import {reviewAppSecurityResults, type ReviewedAppSecurityResults} from '../security-review.js'
import {appSecurityArtifactPaths} from '../app-security-artifacts.js'
import {resolveAppSecurityCommands} from '../app-security-commands.js'
import {appSecurityResultsFor, type AppSecurityResultsSources} from '../app-security-results.test-data.js'
import {
  agentFindingsDocument,
  deterministicFindingsDocument,
} from '../app-security-engine/tests/fixtures/findings-documents.js'
import {unstyled} from '@shopify/cli-kit/node/output'
import {cwd} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {afterEach, describe, expect, test} from 'vitest'
import type {AppSecurityBlockingLevel} from '../app-security-api.js'
import type {AppSecuritySelection} from '../app-security-selection.js'
import type {
  AgentFindingsDocument,
  DeterministicFindingsDocument,
  StoredCheck,
  StoredFinding,
} from '../app-security-engine/index.js'

const originalExitCode = process.exitCode
afterEach(() => {
  process.exitCode = originalExitCode
})

// Selections hold the app directory's real path and paths joined from it with forward slashes, even on Windows.
const onWindows = process.platform === 'win32'
const appDirectory = onWindows ? 'C:\\apps\\my-app' : '/apps/my-app'

/** The absolute native path of a file in the app directory, written out independently of the codec. */
function appPath(relativePath: string): string {
  return onWindows ? `C:\\apps\\my-app\\${relativePath.replaceAll('/', '\\')}` : `/apps/my-app/${relativePath}`
}

const resultsDirectory = appPath('.shopify/app-security/shopify.app')

const selection: AppSecuritySelection = {
  kind: 'config',
  appDirectory,
  appConfigFilePath: `${appDirectory}/shopify.app.toml`,
  configClientId: 'toml-client-id',
}

interface ReviewOptions {
  checkIds?: string[]
  blocking?: AppSecurityBlockingLevel
}

function reviewed(sources: AppSecurityResultsSources, options: ReviewOptions = {}): ReviewedAppSecurityResults {
  return {
    selection,
    result: reviewAppSecurityResults(appSecurityResultsFor(appDirectory, 'shopify.app', sources), {
      resultsDirectory: appSecurityArtifactPaths(appDirectory, 'shopify.app').resultsDirectory,
      checkIds: options.checkIds ?? [],
      blocking: options.blocking ?? 'none',
    }),
    commands: resolveAppSecurityCommands(selection, cwd()),
  }
}

/** Presents the review as JSON and returns the parsed stdout, after checking that stderr is empty. */
async function jsonResult(
  sources: AppSecurityResultsSources,
  options: ReviewOptions & {verbose?: boolean} = {},
): Promise<unknown> {
  return withCapturedStandardStreams(({stdout, stderr}) => {
    renderSecurityReviewResult(reviewed(sources, options), {verbose: options.verbose ?? false}, 'json')
    expect(stderr()).toBe('')
    return JSON.parse(stdout())
  })
}

const snapshot = {
  title: 'Credential reaches a log sink',
  severity: 'high',
  description: 'Detects direct credential flows to console and logger sinks.',
  current_version: 2,
} as const

function deterministicCheck(overrides: Partial<StoredCheck> = {}): StoredCheck {
  return {
    id: 'CREDENTIAL_LOG_LEAKAGE',
    version: 2,
    status: 'executed',
    analysis_mode: 'ast',
    snapshot,
    findings: [],
    ...overrides,
  }
}

function agentCheck(overrides: Partial<StoredCheck> = {}): StoredCheck {
  return {
    id: 'CREDENTIAL_LOG_LEAKAGE',
    version: 2,
    status: 'executed',
    snapshot: {...snapshot, precedence: 'union'},
    findings: [],
    ...overrides,
  }
}

function deterministicDocument(overrides: Partial<DeterministicFindingsDocument> = {}): DeterministicFindingsDocument {
  return {
    schema_version: 1,
    source: 'deterministic',
    engine: {name: 'shopify-app-security', version: '4.9.0', ruleset: 'app-security-rules@4.9.0'},
    generated_at: '2026-09-01T10:00:00.000Z',
    detection: {framework: 'react_router', surface: 'react_router', languages: []},
    coverage: {
      files_scanned: 2,
      files_skipped: [],
      gaps: [],
      scope: {include_dirs: [], excludes: [], no_git_ignore: false},
      scan_directories: [{directory: '.', origin: 'app_directory'}],
    },
    checks: [deterministicCheck()],
    ...overrides,
  }
}

function agentDocument(overrides: Partial<AgentFindingsDocument> = {}): AgentFindingsDocument {
  return {
    schema_version: 1,
    source: 'agent',
    engine: {name: 'shopify-app-security', version: '4.9.0'},
    generated_at: '2026-09-01T11:00:00.000Z',
    scope: {include_dirs: [], excludes: [], no_git_ignore: false},
    checks: [agentCheck()],
    ...overrides,
  }
}

/** The first check of a JSON result. */
async function firstCheck(sources: AppSecurityResultsSources): Promise<Record<string, unknown>> {
  const result = (await jsonResult(sources)) as {checks: Record<string, unknown>[]}
  return result.checks[0]!
}

describe('renderSecurityReviewResult in the terminal', () => {
  const both = {deterministic: deterministicFindingsDocument, agent: agentFindingsDocument}

  test('renders the review and leaves the exit code alone', () => {
    process.exitCode = undefined
    const output = mockAndCaptureOutput()
    output.clear()

    renderSecurityReviewResult(reviewed(both), {verbose: false}, 'text')

    const rendered = unstyled(output.output())
    expect(rendered).toContain('3 checks with findings. 1 check unresolved.')
    expect(rendered).toContain('Next steps')
    expect(rendered).not.toContain('Suppressed:')
    expect(process.exitCode).toBeUndefined()
  })

  test('shows suppressed findings in full with --verbose', () => {
    const output = mockAndCaptureOutput()
    output.clear()

    renderSecurityReviewResult(reviewed(both), {verbose: true}, 'text')

    expect(unstyled(output.output())).toContain('Suppressed: The route is restricted to the app owner')
  })

  test('renders the Blocking section and sets exit code 1 when --blocking is breached', () => {
    process.exitCode = undefined
    const output = mockAndCaptureOutput()
    output.clear()

    renderSecurityReviewResult(reviewed(both, {blocking: 'high'}), {verbose: false}, 'text')

    expect(unstyled(output.error())).toContain('2 checks at or above high (--blocking high).')
    expect(process.exitCode).toBe(1)
  })
})

describe('renderSecurityReviewResult as JSON', () => {
  test('writes one result with both sources, each finding with only its own fields', async () => {
    const docsUrl = 'https://shopify.dev/docs/apps/build/security/app-security-checks/credential-log-leakage'
    const deterministic = deterministicDocument({
      generated_at: '2026-09-01T10:00:00.789Z',
      detection: {
        framework: 'react_router',
        surface: 'react_router',
        languages: [{name: 'typescript', support: 'supported', files: ['app/routes/orders.tsx']}],
      },
      coverage: {
        files_scanned: 12,
        files_skipped: [{path: 'public/vendor.min.js', reason: 'too_large', size_bytes: 2_500_000}],
        gaps: [
          {code: 'unresolved_check', message: 'The parser was unavailable.', check_id: 'MISSING_TENANT_ISOLATION'},
        ],
        scope: {include_dirs: ['../backend'], excludes: ['vendor/**'], no_git_ignore: true},
        scan_directories: [
          {directory: '.', origin: 'app_directory'},
          {directory: '../backend', origin: 'include_dir'},
        ],
      },
      checks: [
        deterministicCheck({
          snapshot: {...snapshot, docs_url: docsUrl},
          findings: [
            {
              location: {file: 'app/routes/orders.tsx', line: 12, column: 5},
              message: 'accessToken flows into console.log.',
              evidence: [
                {location: {file: 'app/routes/orders.tsx', line: 12}, quote: 'console.log(session.accessToken)'},
              ],
              snippet: 'console.log(session.accessToken)',
              fix: {automated: false, description: 'Remove credentials from logs.', guide: 'https://shopify.dev/logs'},
              // The stored format allows another source's fields; a deterministic finding doesn't show them.
              confidence: 'high',
              reasoning: 'Not shown.',
              suppression: {justification: 'Not shown.'},
            },
          ],
        }),
      ],
    })
    const agent = agentDocument({
      generated_at: '2026-09-01T11:00:00.999Z',
      scope: {include_dirs: [], excludes: [], no_git_ignore: false},
      checks: [
        agentCheck({
          snapshot: {...snapshot, docs_url: docsUrl, precedence: 'prefer-agent'},
          findings: [
            {
              location: {file: 'app/routes/orders.tsx', line: 12},
              message: 'The session access token is written to the server log.',
              evidence: [{location: {file: 'app/routes/orders.tsx', line: 12}}],
              confidence: 'high',
              reasoning: 'The session holds a live credential.',
              fix: {automated: true, description: 'Not shown.'},
            },
          ],
        }),
        agentCheck({
          id: 'MISSING_TENANT_ISOLATION',
          version: 4,
          snapshot: {
            title: 'Database query may not be scoped by shop',
            severity: 'high',
            description: "Detects database queries that don't reference the shop.",
            guide: 'https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens',
            current_version: 4,
            precedence: 'union',
          },
          findings: [
            {
              location: {file: 'app/routes/admin.settings.tsx', line: 55},
              message: 'Settings are deleted by ID without checking the owning shop.',
              evidence: [],
              suppression: {justification: 'An allowlist middleware restricts the route to the app owner.'},
            },
          ],
        }),
      ],
    })

    await expect(jsonResult({deterministic, agent})).resolves.toStrictEqual({
      status: 'success',
      valid: true,
      app: {
        directory: appDirectory,
        configurationPath: appPath('shopify.app.toml'),
        clientId: 'toml-client-id',
      },
      resultsDirectory,
      resultsFiles: {
        deterministic: {
          path: appPath('.shopify/app-security/shopify.app/deterministic-findings.json'),
          generatedAt: '2026-09-01T10:00:00Z',
          engine: {name: 'shopify-app-security', version: '4.9.0', ruleset: 'app-security-rules@4.9.0'},
          scope: {includeDirs: ['../backend'], excludes: ['vendor/**'], noGitIgnore: true},
        },
        agent: {
          path: appPath('.shopify/app-security/shopify.app/agent-findings.json'),
          generatedAt: '2026-09-01T11:00:00Z',
          engine: {name: 'shopify-app-security', version: '4.9.0'},
          scope: {includeDirs: [], excludes: [], noGitIgnore: false},
        },
      },
      detection: {
        framework: 'react-router',
        surface: 'react-router',
        languages: [{name: 'typescript', support: 'supported', files: [{path: appPath('app/routes/orders.tsx')}]}],
      },
      coverage: {
        filesScanned: 12,
        filesSkipped: [
          {path: appPath('public/vendor.min.js'), reason: 'too-large', sizeBytes: 2_500_000, detail: null},
        ],
        gaps: [
          {
            code: 'unresolved-check',
            message: 'The parser was unavailable.',
            checkId: 'MISSING_TENANT_ISOLATION',
            filePath: null,
          },
        ],
        scanDirectories: [
          {directory: appDirectory, origin: 'app-directory'},
          {directory: onWindows ? 'C:\\apps\\backend' : '/apps/backend', origin: 'include-dir'},
        ],
      },
      scopeDiffers: true,
      checks: [
        {
          id: 'CREDENTIAL_LOG_LEAKAGE',
          title: 'Credential reaches a log sink',
          severity: 'high',
          description: 'Detects direct credential flows to console and logger sinks.',
          guide: null,
          docsUrl: 'https://shopify.dev/docs/apps/build/security/app-security-checks/credential-log-leakage',
          precedence: 'prefer-agent',
          appliedPrecedence: 'prefer-agent',
          status: 'executed',
          bySource: {
            deterministic: {
              version: 2,
              status: 'executed',
              reason: null,
              analysisMode: 'ast',
              generatedAt: '2026-09-01T10:00:00Z',
            },
            agent: {
              version: 2,
              status: 'executed',
              reason: null,
              analysisMode: null,
              generatedAt: '2026-09-01T11:00:00Z',
            },
          },
          findings: [
            {
              source: 'deterministic',
              disposition: 'superseded',
              location: {filePath: appPath('app/routes/orders.tsx'), line: 12, column: 5},
              message: 'accessToken flows into console.log.',
              snippet: 'console.log(session.accessToken)',
              evidence: [
                {
                  location: {filePath: appPath('app/routes/orders.tsx'), line: 12, column: null},
                  quote: 'console.log(session.accessToken)',
                },
              ],
              fix: {description: 'Remove credentials from logs.', guide: 'https://shopify.dev/logs', automated: false},
            },
            {
              source: 'agent',
              disposition: 'active',
              location: {filePath: appPath('app/routes/orders.tsx'), line: 12, column: null},
              message: 'The session access token is written to the server log.',
              snippet: null,
              evidence: [{location: {filePath: appPath('app/routes/orders.tsx'), line: 12, column: null}, quote: null}],
              confidence: 'high',
              reasoning: 'The session holds a live credential.',
              suppression: null,
            },
          ],
        },
        {
          id: 'MISSING_TENANT_ISOLATION',
          title: 'Database query may not be scoped by shop',
          severity: 'high',
          description: "Detects database queries that don't reference the shop.",
          guide: 'https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens',
          docsUrl: null,
          precedence: 'union',
          appliedPrecedence: 'union',
          status: 'executed',
          bySource: {
            deterministic: null,
            agent: {
              version: 4,
              status: 'executed',
              reason: null,
              analysisMode: null,
              generatedAt: '2026-09-01T11:00:00Z',
            },
          },
          findings: [
            {
              source: 'agent',
              disposition: 'suppressed',
              location: {filePath: appPath('app/routes/admin.settings.tsx'), line: 55, column: null},
              message: 'Settings are deleted by ID without checking the owning shop.',
              snippet: null,
              evidence: [],
              confidence: null,
              reasoning: null,
              suppression: {justification: 'An allowlist middleware restricts the route to the app owner.'},
            },
          ],
        },
      ],
      blocking: {level: 'none', blockedCheckCount: 0},
    })
  })

  test('writes null and empty values when neither results file exists', async () => {
    await expect(jsonResult({deterministic: null, agent: null})).resolves.toStrictEqual({
      status: 'success',
      valid: true,
      app: {directory: appDirectory, configurationPath: appPath('shopify.app.toml'), clientId: 'toml-client-id'},
      resultsDirectory,
      resultsFiles: {deterministic: null, agent: null},
      detection: null,
      coverage: null,
      scopeDiffers: false,
      checks: [],
      blocking: {level: 'none', blockedCheckCount: 0},
    })
  })

  test('writes null for the optional values that a results file leaves out', async () => {
    const deterministic = deterministicDocument({
      coverage: {
        ...deterministicDocument().coverage,
        files_skipped: [{path: 'secrets.bin', reason: 'unreadable'}],
        gaps: [{code: 'unsupported_language', message: 'Ruby is not supported.'}],
      },
      checks: [
        deterministicCheck({
          status: 'not_applicable',
          analysis_mode: undefined,
          findings: [{location: {file: 'shopify.app.toml'}, message: 'Compliance webhooks are missing.', evidence: []}],
        }),
      ],
    })

    const result = (await jsonResult({deterministic, agent: null})) as {
      coverage: unknown
      checks: Record<string, unknown>[]
    }

    expect(result.coverage).toMatchObject({
      filesSkipped: [{path: appPath('secrets.bin'), reason: 'unreadable', sizeBytes: null, detail: null}],
      gaps: [{code: 'unsupported-language', message: 'Ruby is not supported.', checkId: null, filePath: null}],
    })
    expect(result.checks[0]).toMatchObject({
      guide: null,
      docsUrl: null,
      bySource: {
        deterministic: {version: 2, status: 'not-applicable', reason: null, analysisMode: null},
        agent: null,
      },
      findings: [
        {
          source: 'deterministic',
          disposition: 'active',
          location: {filePath: appPath('shopify.app.toml'), line: null, column: null},
          message: 'Compliance webhooks are missing.',
          snippet: null,
          evidence: [],
          fix: null,
        },
      ],
    })
  })

  // The text view shows neither a missing nor an empty optional text, so JSON output writes null for both.
  const finding: StoredFinding = {
    location: {file: 'app/routes/orders.tsx', line: 12},
    message: 'accessToken flows into console.log.',
    evidence: [{location: {file: 'app/routes/orders.tsx', line: 12}}],
  }
  const withDeterministicFinding = (overrides: Partial<StoredFinding>): AppSecurityResultsSources => ({
    deterministic: deterministicDocument({checks: [deterministicCheck({findings: [{...finding, ...overrides}]})]}),
    agent: null,
  })
  const optionalTexts = [
    [
      'finding snippet',
      (text: string) => withDeterministicFinding({snippet: text}),
      (result: any) => result.checks[0].findings[0].snippet,
    ],
    [
      'evidence quote',
      (text: string) => withDeterministicFinding({evidence: [{...finding.evidence[0]!, quote: text}]}),
      (result: any) => result.checks[0].findings[0].evidence[0].quote,
    ],
    [
      'fix guide',
      (text: string) => withDeterministicFinding({fix: {automated: false, description: 'Remove it.', guide: text}}),
      (result: any) => result.checks[0].findings[0].fix.guide,
    ],
    [
      'agent reasoning',
      (text: string) => ({
        deterministic: null,
        agent: agentDocument({checks: [agentCheck({findings: [{...finding, reasoning: text}]})]}),
      }),
      (result: any) => result.checks[0].findings[0].reasoning,
    ],
    [
      'check guide',
      (text: string) => ({
        deterministic: deterministicDocument({checks: [deterministicCheck({snapshot: {...snapshot, guide: text}})]}),
        agent: null,
      }),
      (result: any) => result.checks[0].guide,
    ],
    [
      'skipped file detail',
      (text: string) => ({
        deterministic: deterministicDocument({
          coverage: {
            ...deterministicDocument().coverage,
            files_skipped: [{path: 'secrets.bin', reason: 'unreadable', detail: text}],
          },
        }),
        agent: null,
      }),
      (result: any) => result.coverage.filesSkipped[0].detail,
    ],
  ] as const

  test.each(optionalTexts)('writes an empty %s as null', async (_field, sources, read) => {
    expect(read(await jsonResult(sources('')))).toBeNull()
  })

  test.each(optionalTexts)('keeps a non-empty %s as recorded, even whitespace', async (_field, sources, read) => {
    expect(read(await jsonResult(sources('A value.')))).toBe('A value.')
    expect(read(await jsonResult(sources(' ')))).toBe(' ')
  })

  test('writes lines and columns one-based, as recorded', async () => {
    const finding: StoredFinding = {
      location: {file: 'app/routes/orders.tsx', line: 1, column: 1},
      message: 'accessToken flows into console.log.',
      evidence: [{location: {file: 'app/shopify.server.ts', line: 40, column: 7}, quote: 'logger.info(apiSecretKey)'}],
    }
    const deterministic = deterministicDocument({checks: [deterministicCheck({findings: [finding]})]})

    const check = await firstCheck({deterministic, agent: null})

    expect(check.findings).toMatchObject([
      {
        location: {filePath: appPath('app/routes/orders.tsx'), line: 1, column: 1},
        evidence: [{location: {filePath: appPath('app/shopify.server.ts'), line: 40, column: 7}}],
      },
    ])
  })

  test.each([
    ['truncates fractional seconds without rounding', '2026-09-01T10:00:59.999Z', '2026-09-01T10:00:59Z'],
    ['converts an offset to UTC', '2026-09-01T12:00:00+02:00', '2026-09-01T10:00:00Z'],
    ['writes null for a time that does not parse', 'yesterday', null],
    ['writes null for a year that does not fit four digits', '+010000-01-01T00:00:00Z', null],
  ])('%s', async (_description, generatedAt, expected) => {
    const deterministic = deterministicDocument({generated_at: generatedAt})

    const result = (await jsonResult({deterministic, agent: null})) as {
      resultsFiles: {deterministic: {generatedAt: unknown}}
      checks: {bySource: {deterministic: {generatedAt: unknown}}}[]
    }

    expect(result.resultsFiles.deterministic.generatedAt).toBe(expected)
    expect(result.checks[0]!.bySource.deterministic.generatedAt).toBe(expected)
  })

  test.each([
    ['high', 'high'],
    ['medium', 'medium'],
    ['low', 'low'],
  ] as const)('maps severity %s to %s', async (severity, expected) => {
    const deterministic = deterministicDocument({checks: [deterministicCheck({snapshot: {...snapshot, severity}})]})

    await expect(firstCheck({deterministic, agent: null})).resolves.toMatchObject({severity: expected})
  })

  test.each([
    ['executed', 'executed'],
    ['not_applicable', 'not-applicable'],
    ['unresolved', 'unresolved'],
  ] as const)('maps check status %s to %s', async (status, expected) => {
    const deterministic = deterministicDocument({checks: [deterministicCheck({status})]})

    await expect(firstCheck({deterministic, agent: null})).resolves.toMatchObject({
      status: expected,
      bySource: {deterministic: {status: expected}},
    })
  })

  test.each([
    ['union', 'union'],
    ['prefer-agent', 'prefer-agent'],
  ] as const)('maps precedence %s to %s', async (precedence, expected) => {
    const agent = agentDocument({checks: [agentCheck({snapshot: {...snapshot, precedence}})]})

    await expect(firstCheck({deterministic: null, agent})).resolves.toMatchObject({
      precedence: expected,
      appliedPrecedence: expected,
    })
  })

  test('maps the precedence that applied separately when a prefer-agent agent result is stale', async () => {
    const deterministic = deterministicDocument({generated_at: '2026-09-01T12:00:00.000Z'})
    const agent = agentDocument({checks: [agentCheck({snapshot: {...snapshot, precedence: 'prefer-agent'}})]})

    await expect(firstCheck({deterministic, agent})).resolves.toMatchObject({
      precedence: 'prefer-agent',
      appliedPrecedence: 'union',
    })
  })

  test.each([
    ['regex', 'regex'],
    ['structured_config', 'structured-config'],
    ['ast', 'ast'],
  ] as const)('maps analysis mode %s to %s', async (mode, expected) => {
    const deterministic = deterministicDocument({checks: [deterministicCheck({analysis_mode: mode})]})

    await expect(firstCheck({deterministic, agent: null})).resolves.toMatchObject({
      bySource: {deterministic: {analysisMode: expected}},
    })
  })

  test.each([
    ['high', 'high'],
    ['medium', 'medium'],
    ['low', 'low'],
  ] as const)('maps agent confidence %s to %s', async (confidence, expected) => {
    const finding: StoredFinding = {
      location: {file: 'app/routes/orders.tsx', line: 3},
      message: 'A finding.',
      evidence: [],
      confidence,
    }
    const agent = agentDocument({checks: [agentCheck({findings: [finding]})]})

    await expect(firstCheck({deterministic: null, agent})).resolves.toMatchObject({
      findings: [{source: 'agent', confidence: expected}],
    })
  })

  test('maps every disposition', async () => {
    const finding = (message: string): StoredFinding => ({
      location: {file: 'app/routes/orders.tsx', line: 3},
      message,
      evidence: [],
    })
    const deterministic = deterministicDocument({checks: [deterministicCheck({findings: [finding('Superseded.')]})]})
    const agent = agentDocument({
      checks: [
        agentCheck({
          snapshot: {...snapshot, precedence: 'prefer-agent'},
          findings: [finding('Active.'), {...finding('Suppressed.'), suppression: {justification: 'Accepted risk.'}}],
        }),
      ],
    })

    const check = await firstCheck({deterministic, agent})

    expect(check.findings).toMatchObject([
      {source: 'deterministic', message: 'Superseded.', disposition: 'superseded'},
      {source: 'agent', message: 'Active.', disposition: 'active'},
      {source: 'agent', message: 'Suppressed.', disposition: 'suppressed'},
    ])
  })

  test.each([
    ['react_router', 'react-router'],
    ['none', 'none'],
    ['unknown', 'unknown'],
    ['mixed', 'mixed'],
  ] as const)('maps framework %s to %s', async (framework, expected) => {
    const deterministic = deterministicDocument({detection: {framework, surface: 'unknown', languages: []}})

    await expect(jsonResult({deterministic, agent: null})).resolves.toMatchObject({detection: {framework: expected}})
  })

  test.each([
    ['react_router', 'react-router'],
    ['theme_app_extension', 'theme-app-extension'],
    ['config_only', 'config-only'],
    ['unknown', 'unknown'],
    ['mixed', 'mixed'],
  ] as const)('maps surface %s to %s', async (surface, expected) => {
    const deterministic = deterministicDocument({detection: {framework: 'none', surface, languages: []}})

    await expect(jsonResult({deterministic, agent: null})).resolves.toMatchObject({detection: {surface: expected}})
  })

  test.each([
    ['supported', 'supported'],
    ['unsupported', 'unsupported'],
  ] as const)('maps language support %s to %s', async (support, expected) => {
    const deterministic = deterministicDocument({
      detection: {framework: 'none', surface: 'unknown', languages: [{name: 'ruby', support, files: ['Gemfile']}]},
    })

    await expect(jsonResult({deterministic, agent: null})).resolves.toMatchObject({
      detection: {languages: [{name: 'ruby', support: expected, files: [{path: appPath('Gemfile')}]}]},
    })
  })

  test.each([
    ['too_large', 'too-large'],
    ['unreadable', 'unreadable'],
  ] as const)('maps skipped file reason %s to %s', async (reason, expected) => {
    const deterministic = deterministicDocument({
      coverage: {...deterministicDocument().coverage, files_skipped: [{path: 'big.js', reason}]},
    })

    await expect(jsonResult({deterministic, agent: null})).resolves.toMatchObject({
      coverage: {filesSkipped: [{reason: expected}]},
    })
  })

  test.each([
    ['skipped_file', 'skipped-file'],
    ['unsupported_framework', 'unsupported-framework'],
    ['unsupported_language', 'unsupported-language'],
    ['unresolved_check', 'unresolved-check'],
  ] as const)('maps coverage gap code %s to %s', async (code, expected) => {
    const deterministic = deterministicDocument({
      coverage: {...deterministicDocument().coverage, gaps: [{code, message: 'A gap.', file: 'app/routes/orders.tsx'}]},
    })

    await expect(jsonResult({deterministic, agent: null})).resolves.toMatchObject({
      coverage: {
        gaps: [{code: expected, message: 'A gap.', checkId: null, filePath: appPath('app/routes/orders.tsx')}],
      },
    })
  })

  test.each([
    ['app_directory', 'app-directory', '.', appDirectory],
    ['include_dir', 'include-dir', 'packages/backend', appPath('packages/backend')],
    ['app_config_directory', 'app-config-directory', 'extensions/theme', appPath('extensions/theme')],
  ] as const)('maps scan directory origin %s to %s', async (origin, expectedOrigin, directory, expectedDirectory) => {
    const deterministic = deterministicDocument({
      coverage: {...deterministicDocument().coverage, scan_directories: [{directory, origin}]},
    })

    await expect(jsonResult({deterministic, agent: null})).resolves.toMatchObject({
      coverage: {scanDirectories: [{directory: expectedDirectory, origin: expectedOrigin}]},
    })
  })

  test('passes reason codes through verbatim', async () => {
    const reason = {code: 'needs_runtime', message: 'Route registration happens at runtime.'}
    const agent = agentDocument({checks: [agentCheck({status: 'unresolved', reason})]})

    await expect(firstCheck({deterministic: null, agent})).resolves.toMatchObject({
      bySource: {agent: {status: 'unresolved', reason}},
    })
  })

  test('narrows the checks and the blocked checks with --check-id', async () => {
    const both = {deterministic: deterministicFindingsDocument, agent: agentFindingsDocument}

    const result = await jsonResult(both, {checkIds: ['EOL_API_VERSION'], blocking: 'low'})

    expect(result).toMatchObject({
      valid: false,
      checks: [{id: 'EOL_API_VERSION'}],
      blocking: {level: 'low', blockedCheckCount: 1},
    })
    expect((result as {checks: unknown[]}).checks).toHaveLength(1)
  })

  test('is valid with --blocking none whatever the active findings', async () => {
    process.exitCode = undefined
    const both = {deterministic: deterministicFindingsDocument, agent: agentFindingsDocument}

    await expect(jsonResult(both, {blocking: 'none'})).resolves.toMatchObject({
      valid: true,
      blocking: {level: 'none', blockedCheckCount: 0},
    })
    expect(process.exitCode).toBeUndefined()
  })

  test('writes the result, then sets exit code 1 when --blocking is breached', async () => {
    process.exitCode = undefined
    const both = {deterministic: deterministicFindingsDocument, agent: agentFindingsDocument}

    await withCapturedStandardStreams(({stdout}) => {
      renderSecurityReviewResult(reviewed(both, {blocking: 'high'}), {verbose: false}, 'json')

      expect(JSON.parse(stdout())).toMatchObject({valid: false, blocking: {level: 'high', blockedCheckCount: 2}})
    })
    expect(process.exitCode).toBe(1)
  })

  test('writes the same result with --verbose', async () => {
    const both = {deterministic: deterministicFindingsDocument, agent: agentFindingsDocument}

    await expect(jsonResult(both, {verbose: true})).resolves.toStrictEqual(await jsonResult(both, {verbose: false}))
  })
})

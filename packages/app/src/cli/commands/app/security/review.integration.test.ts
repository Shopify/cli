import SecurityReview from './review.js'
import {appSecurityArtifactPaths, appSecuritySuppressionsPath} from '../../../services/app-security-artifacts.js'
import {validAppConfiguration} from '../../../services/app-security-selection.test-data.js'
import {Config} from '@oclif/core'
import {fileExists, fileRealPath, inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {unstyled} from '@shopify/cli-kit/node/output'
import {joinPath} from '@shopify/cli-kit/node/path'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test, vi} from 'vitest'
// eslint-disable-next-line no-restricted-imports -- Verify native filesystem paths in JSON output.
import {resolve} from 'node:path'
import type {AgentFindingsDocument, DeterministicFindingsDocument} from '../../../services/app-security-engine/index.js'

// Skip the installed-CLI error reporting setup, as `check`'s command boundary test does.
vi.mock('@shopify/cli-kit/node/context/local', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/context/local')>()),
  isDevelopment: () => true,
}))
// Command lifecycle telemetry is unrelated to reviewing. Keep the real error handler and renderer.
vi.mock('@shopify/cli-kit/node/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/analytics')>()),
  reportAnalyticsEvent: vi.fn(),
}))

const credentialLogLeakage = {
  title: 'Credential reaches a log sink',
  severity: 'high',
  description: 'Detects direct credential flows to console and logger sinks.',
  docs_url: 'https://shopify.dev/docs/apps/build/security/app-security-checks/credential-log-leakage',
  current_version: 2,
} as const

const tenantIsolation = {
  title: 'Database query may not be scoped by shop',
  severity: 'high',
  description: "Detects database queries that don't reference the shop.",
  docs_url: 'https://shopify.dev/docs/apps/build/security/app-security-checks/missing-tenant-isolation',
  current_version: 4,
} as const

const eolApiVersion = {
  title: 'End-of-life API version',
  severity: 'low',
  description: 'Detects API versions past their support window.',
  guide: 'https://shopify.dev/docs/api/usage/versioning',
  docs_url: 'https://shopify.dev/docs/apps/build/security/app-security-checks/eol-api-version',
  current_version: 2,
} as const

const deterministicFindings: DeterministicFindingsDocument = {
  schema_version: 1,
  source: 'deterministic',
  engine: {name: 'shopify-app-security', version: '4.9.0', ruleset: 'app-security-rules@4.9.0'},
  generated_at: '2026-09-01T10:00:00.250Z',
  detection: {
    framework: 'react_router',
    surface: 'react_router',
    languages: [{name: 'typescript', support: 'supported', files: ['app/routes/orders.tsx']}],
  },
  coverage: {
    files_scanned: 3,
    files_skipped: [],
    gaps: [],
    scope: {include_dirs: [], excludes: [], no_git_ignore: false},
    scan_directories: [{directory: '.', origin: 'app_directory'}],
  },
  checks: [
    {
      id: 'CREDENTIAL_LOG_LEAKAGE',
      version: 2,
      status: 'executed',
      analysis_mode: 'ast',
      snapshot: credentialLogLeakage,
      findings: [
        {
          location: {file: 'app/routes/orders.tsx', line: 5, column: 3},
          message: 'accessToken flows into console.log.',
          evidence: [{location: {file: 'app/routes/orders.tsx', line: 5}, quote: 'console.log(session.accessToken)'}],
          snippet: 'console.log(session.accessToken)',
          fix: {automated: false, description: 'Remove credentials from logs.'},
        },
      ],
    },
    {
      id: 'EOL_API_VERSION',
      version: 2,
      status: 'executed',
      analysis_mode: 'structured_config',
      snapshot: eolApiVersion,
      findings: [
        {
          location: {file: 'shopify.app.toml', line: 8},
          message: 'api_version 2024-01 is past its support window.',
          evidence: [],
          fix: {
            automated: false,
            description: 'Update api_version.',
            guide: 'https://shopify.dev/docs/api/usage/versioning',
          },
        },
      ],
    },
  ],
}

const agentFindings: AgentFindingsDocument = {
  schema_version: 1,
  source: 'agent',
  engine: {name: 'shopify-app-security', version: '4.9.0'},
  generated_at: '2026-09-01T11:00:00.000Z',
  scope: {include_dirs: [], excludes: [], no_git_ignore: false},
  checks: [
    {
      id: 'CREDENTIAL_LOG_LEAKAGE',
      version: 2,
      status: 'executed',
      snapshot: {...credentialLogLeakage, precedence: 'prefer-agent'},
      findings: [
        {
          location: {file: 'app/routes/orders.tsx', line: 5},
          message: 'The session access token is written to the server log.',
          evidence: [{location: {file: 'app/routes/orders.tsx', line: 5}, quote: 'console.log(session.accessToken)'}],
          confidence: 'high',
          reasoning: 'The session holds a live credential.',
        },
      ],
    },
    {
      id: 'MISSING_TENANT_ISOLATION',
      version: 4,
      status: 'executed',
      snapshot: {...tenantIsolation, precedence: 'union'},
      findings: [
        {
          location: {file: 'app/shopify.server.ts', line: 3},
          message: 'The app configuration is shared by every shop.',
          evidence: [{location: {file: 'app/shopify.server.ts', line: 3}}],
          suppression: {justification: 'The configuration holds no shop data.'},
        },
      ],
    },
  ],
}

/** Entries that suppress the active findings of both documents: a deterministic one, and an agent one. */
const suppressionEntries = [
  {
    source: 'deterministic',
    check: 'EOL_API_VERSION',
    kind: 'accepted-risk',
    path: 'shopify.app.toml',
    code: 'api_version 2024-01',
    reason: 'The upgrade ships with the next release.',
    configurations: ['shopify.app.toml'],
  },
  {
    source: 'agent',
    check: 'CREDENTIAL_LOG_LEAKAGE',
    kind: 'false-positive',
    path: 'app/routes/orders.tsx',
    reason: 'The logger redacts tokens.',
    configurations: ['shopify.app.toml'],
  },
]

async function writeSuppressions(appDirectory: string, suppressions: unknown[]): Promise<void> {
  await writeFile(appSecuritySuppressionsPath(appDirectory), JSON.stringify({schema_version: 1, suppressions}))
}

/** The deterministic document with line 0 on its first finding, as a hand edit could leave it. */
function withZeroLine(document: DeterministicFindingsDocument): DeterministicFindingsDocument {
  const [first, ...rest] = document.checks
  const [finding, ...otherFindings] = first!.findings
  return {
    ...document,
    checks: [
      {...first!, findings: [{...finding!, location: {...finding!.location, line: 0}}, ...otherFindings]},
      ...rest,
    ],
  }
}

interface ResultsFiles {
  deterministic?: unknown
  agent?: unknown
}

/** Creates an app linked to `test-client-id` with the `shopify.app` results directory, and returns its real path. */
async function createApp(directory: string, files: ResultsFiles | null = {}): Promise<string> {
  await writeFile(joinPath(directory, 'shopify.app.toml'), validAppConfiguration('test-client-id'))
  const appDirectory = await fileRealPath(directory)
  if (files === null) return appDirectory

  const paths = appSecurityArtifactPaths(appDirectory, 'shopify.app')
  await mkdir(paths.resultsDirectory)
  if (files.deterministic) await writeFile(paths.deterministicFindingsPath, JSON.stringify(files.deterministic))
  if (files.agent) await writeFile(paths.agentFindingsPath, JSON.stringify(files.agent))
  return appDirectory
}

function resultsPath(appDirectory: string, ...segments: string[]): string {
  return resolve(appDirectory, '.shopify', 'app-security', 'shopify.app', ...segments)
}

/** The results path as the section titles show it: cli-kit's `joinPath` uses forward slashes on every OS, unlike `resultsPath`. */
function renderedResultsPath(appDirectory: string, ...segments: string[]): string {
  return joinPath(appDirectory, '.shopify', 'app-security', 'shopify.app', ...segments)
}

function appJson(appDirectory: string) {
  return {
    directory: resolve(appDirectory),
    configurationPath: resolve(appDirectory, 'shopify.app.toml'),
    clientId: 'test-client-id',
  }
}

function deterministicResultsFileJson(appDirectory: string) {
  return {
    path: resultsPath(appDirectory, 'deterministic-findings.json'),
    generatedAt: '2026-09-01T10:00:00Z',
    engine: {name: 'shopify-app-security', version: '4.9.0', ruleset: 'app-security-rules@4.9.0'},
    scope: {includeDirs: [], excludes: [], noGitIgnore: false},
  }
}

function detectionJson(appDirectory: string) {
  return {
    framework: 'react-router',
    surface: 'react-router',
    languages: [
      {name: 'typescript', support: 'supported', files: [{path: resolve(appDirectory, 'app', 'routes', 'orders.tsx')}]},
    ],
  }
}

function coverageJson(appDirectory: string) {
  return {
    filesScanned: 3,
    filesSkipped: [],
    gaps: [],
    scanDirectories: [{directory: resolve(appDirectory), origin: 'app-directory'}],
  }
}

/** EOL_API_VERSION with its one finding, which has this number. */
function eolApiVersionJson(appDirectory: string, findingNumber: number) {
  return {
    id: 'EOL_API_VERSION',
    title: 'End-of-life API version',
    severity: 'low',
    description: 'Detects API versions past their support window.',
    guide: 'https://shopify.dev/docs/api/usage/versioning',
    docsUrl: 'https://shopify.dev/docs/apps/build/security/app-security-checks/eol-api-version',
    precedence: 'union',
    appliedPrecedence: 'union',
    status: 'executed',
    bySource: {
      deterministic: {
        version: 2,
        status: 'executed',
        reason: null,
        analysisMode: 'structured-config',
        generatedAt: '2026-09-01T10:00:00Z',
      },
      agent: null,
    },
    findings: [
      {
        source: 'deterministic',
        number: findingNumber,
        disposition: 'active',
        location: {filePath: resolve(appDirectory, 'shopify.app.toml'), line: 8, column: null},
        message: 'api_version 2024-01 is past its support window.',
        snippet: null,
        evidence: [],
        fix: {
          description: 'Update api_version.',
          guide: 'https://shopify.dev/docs/api/usage/versioning',
          automated: false,
        },
        suppression: null,
      },
    ],
  }
}

/** The top-level suppressions of a result without shopify.app-security.json. */
function noSuppressionsFileJson(appDirectory: string) {
  return {
    filePath: resolve(appDirectory, 'shopify.app-security.json'),
    entryCount: 0,
    suppressedFindingCount: 0,
    staleEntryCount: 0,
    ambiguousEntryCount: 0,
    entries: [],
  }
}

// Boxes wrap text across lines and draw borders, so compare their text with the borders and line breaks removed.
function boxText(output: string): string {
  return unstyled(output).replaceAll('│', '').replace(/\s+/g, ' ')
}

async function runCommand(argv: string[]) {
  const previousExitCode = process.exitCode
  process.exitCode = 0
  // Observe the real Oclif error handler's requested exit without terminating the test worker.
  const exit = vi.spyOn(process, 'exit').mockImplementation((code) => {
    process.exitCode = code ?? 0
    return undefined as never
  })
  try {
    const output = await withCapturedStandardStreams(async ({stdout, stderr}) => {
      const config = await Config.load(import.meta.url)
      // This test invokes the app command directly, not as a separately installed CLI plugin.
      config.plugins.clear()
      await SecurityReview.run(argv, config)
      return {stdout: stdout(), stderr: stderr()}
    })
    return {...output, exitCode: process.exitCode}
  } finally {
    exit.mockRestore()
    process.exitCode = previousExitCode
  }
}

/**
 * Runs the command with --json. The error handler reads --json from the process arguments, not from the arguments
 * given to `run`, so the environment sets it as well.
 */
async function runJsonCommand(argv: string[]) {
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  try {
    return await runCommand([...argv, '--json'])
  } finally {
    vi.unstubAllEnvs()
  }
}

describe('app security review command boundary', () => {
  test('--json writes one result with the deterministic results alone', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory, {deterministic: deterministicFindings})

      const result = await runJsonCommand(['--path', directory])

      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout)).toStrictEqual({
        status: 'success',
        valid: true,
        app: appJson(appDirectory),
        resultsDirectory: resultsPath(appDirectory),
        resultsFiles: {deterministic: deterministicResultsFileJson(appDirectory), agent: null},
        detection: detectionJson(appDirectory),
        coverage: coverageJson(appDirectory),
        scopeDiffers: false,
        checks: [
          {
            id: 'CREDENTIAL_LOG_LEAKAGE',
            title: 'Credential reaches a log sink',
            severity: 'high',
            description: 'Detects direct credential flows to console and logger sinks.',
            guide: null,
            docsUrl: 'https://shopify.dev/docs/apps/build/security/app-security-checks/credential-log-leakage',
            precedence: 'union',
            appliedPrecedence: 'union',
            status: 'executed',
            bySource: {
              deterministic: {
                version: 2,
                status: 'executed',
                reason: null,
                analysisMode: 'ast',
                generatedAt: '2026-09-01T10:00:00Z',
              },
              agent: null,
            },
            findings: [
              {
                source: 'deterministic',
                number: 1,
                disposition: 'active',
                location: {filePath: resolve(appDirectory, 'app', 'routes', 'orders.tsx'), line: 5, column: 3},
                message: 'accessToken flows into console.log.',
                snippet: 'console.log(session.accessToken)',
                evidence: [
                  {
                    location: {filePath: resolve(appDirectory, 'app', 'routes', 'orders.tsx'), line: 5, column: null},
                    quote: 'console.log(session.accessToken)',
                  },
                ],
                fix: {description: 'Remove credentials from logs.', guide: null, automated: false},
                suppression: null,
              },
            ],
          },
          eolApiVersionJson(appDirectory, 2),
        ],
        resultsDigest: expect.stringMatching(/^[0-9a-f]{12}$/),
        blocking: {level: 'none', blockedCheckCount: 0},
        suppressions: noSuppressionsFileJson(appDirectory),
        savedSuppressions: null,
      })
      expect(result.stderr).toBe('')
    })
  })

  test('--json combines both sources, with a prefer-agent check and a suppressed finding', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory, {deterministic: deterministicFindings, agent: agentFindings})

      const result = await runJsonCommand(['--path', directory])

      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout)).toStrictEqual({
        status: 'success',
        valid: true,
        app: appJson(appDirectory),
        resultsDirectory: resultsPath(appDirectory),
        resultsFiles: {
          deterministic: deterministicResultsFileJson(appDirectory),
          agent: {
            path: resultsPath(appDirectory, 'agent-findings.json'),
            generatedAt: '2026-09-01T11:00:00Z',
            engine: {name: 'shopify-app-security', version: '4.9.0'},
            scope: {includeDirs: [], excludes: [], noGitIgnore: false},
          },
        },
        detection: detectionJson(appDirectory),
        coverage: coverageJson(appDirectory),
        scopeDiffers: false,
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
                number: 1,
                disposition: 'superseded',
                location: {filePath: resolve(appDirectory, 'app', 'routes', 'orders.tsx'), line: 5, column: 3},
                message: 'accessToken flows into console.log.',
                snippet: 'console.log(session.accessToken)',
                evidence: [
                  {
                    location: {filePath: resolve(appDirectory, 'app', 'routes', 'orders.tsx'), line: 5, column: null},
                    quote: 'console.log(session.accessToken)',
                  },
                ],
                fix: {description: 'Remove credentials from logs.', guide: null, automated: false},
                suppression: null,
              },
              {
                source: 'agent',
                number: 2,
                disposition: 'active',
                location: {filePath: resolve(appDirectory, 'app', 'routes', 'orders.tsx'), line: 5, column: null},
                message: 'The session access token is written to the server log.',
                snippet: null,
                evidence: [
                  {
                    location: {filePath: resolve(appDirectory, 'app', 'routes', 'orders.tsx'), line: 5, column: null},
                    quote: 'console.log(session.accessToken)',
                  },
                ],
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
            guide: null,
            docsUrl: 'https://shopify.dev/docs/apps/build/security/app-security-checks/missing-tenant-isolation',
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
                number: 3,
                disposition: 'suppressed',
                location: {filePath: resolve(appDirectory, 'app', 'shopify.server.ts'), line: 3, column: null},
                message: 'The app configuration is shared by every shop.',
                snippet: null,
                evidence: [
                  {
                    location: {filePath: resolve(appDirectory, 'app', 'shopify.server.ts'), line: 3, column: null},
                    quote: null,
                  },
                ],
                confidence: null,
                reasoning: null,
                suppression: {justification: 'The configuration holds no shop data.', origin: 'agent'},
              },
            ],
          },
          eolApiVersionJson(appDirectory, 4),
        ],
        resultsDigest: expect.stringMatching(/^[0-9a-f]{12}$/),
        blocking: {level: 'none', blockedCheckCount: 0},
        suppressions: noSuppressionsFileJson(appDirectory),
        savedSuppressions: null,
      })
      expect(result.stderr).toBe('')
    })
  })

  test('--json writes no checks and no results files when the results directory is empty', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory)

      const result = await runJsonCommand(['--path', directory, '--blocking', 'high'])

      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout)).toStrictEqual({
        status: 'success',
        valid: true,
        app: appJson(appDirectory),
        resultsDirectory: resultsPath(appDirectory),
        resultsFiles: {deterministic: null, agent: null},
        detection: null,
        coverage: null,
        scopeDiffers: false,
        checks: [],
        resultsDigest: null,
        blocking: {level: 'high', blockedCheckCount: 0},
        suppressions: noSuppressionsFileJson(appDirectory),
        savedSuppressions: null,
      })
      expect(result.stderr).toBe('')
    })
  })

  test('--json with --check-id narrows the checks and the blocked checks', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory, {deterministic: deterministicFindings, agent: agentFindings})

      // Without --check-id, CREDENTIAL_LOG_LEAKAGE's active agent finding fails --blocking high.
      const result = await runJsonCommand(['--path', directory, '--check-id', 'EOL_API_VERSION', '--blocking', 'high'])

      expect(result.exitCode).toBe(0)
      const document = JSON.parse(result.stdout)
      expect(document.checks.map((check: {id: string}) => check.id)).toStrictEqual(['EOL_API_VERSION'])
      expect(document).toMatchObject({valid: true, blocking: {level: 'high', blockedCheckCount: 0}})
    })
  })

  test('--json with a breached --blocking writes the result and exits 1', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory, {deterministic: deterministicFindings, agent: agentFindings})

      const result = await runJsonCommand(['--path', directory, '--blocking', 'low'])

      expect(result.exitCode).toBe(1)
      const document = JSON.parse(result.stdout)
      // CREDENTIAL_LOG_LEAKAGE and EOL_API_VERSION have active findings; MISSING_TENANT_ISOLATION's is suppressed.
      expect(document).toMatchObject({status: 'success', valid: false, blocking: {level: 'low', blockedCheckCount: 2}})
      expect(document.checks).toHaveLength(3)
      expect(result.stderr).toBe('')
    })
  })

  test('--json with --blocking none is valid and exits 0 whatever the active findings', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory, {deterministic: deterministicFindings, agent: agentFindings})

      const result = await runJsonCommand(['--path', directory, '--blocking', 'none'])

      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({valid: true, blocking: {level: 'none', blockedCheckCount: 0}})
    })
  })

  test('--json writes the same result with --verbose', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory, {deterministic: deterministicFindings, agent: agentFindings})

      const concise = await runJsonCommand(['--path', directory])
      const verbose = await runJsonCommand(['--path', directory, '--verbose'])

      expect(verbose.exitCode).toBe(0)
      expect(verbose.stdout).toBe(concise.stdout)
    })
  })

  test('--json applies shopify.app-security.json to both sources, and suppressed findings pass --blocking', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory, {deterministic: deterministicFindings, agent: agentFindings})
      await writeSuppressions(appDirectory, suppressionEntries)

      const result = await runJsonCommand(['--path', directory, '--blocking', 'low'])

      expect(result.exitCode).toBe(0)
      const document = JSON.parse(result.stdout)
      expect(document).toMatchObject({valid: true, blocking: {level: 'low', blockedCheckCount: 0}})
      const dispositions = document.checks.map(
        (check: {id: string; findings: {source: string; disposition: string}[]}) => [
          check.id,
          check.findings.map(({source, disposition}) => `${source} ${disposition}`),
        ],
      )
      expect(dispositions).toStrictEqual([
        ['CREDENTIAL_LOG_LEAKAGE', ['deterministic superseded', 'agent suppressed']],
        ['MISSING_TENANT_ISOLATION', ['agent suppressed']],
        ['EOL_API_VERSION', ['deterministic suppressed']],
      ])
      const suppressions = document.checks.map((check: {findings: {suppression: unknown}[]}) =>
        check.findings.map(({suppression}) => suppression),
      )
      expect(suppressions).toStrictEqual([
        [null, {justification: 'The logger redacts tokens.', origin: 'file', entryIndex: 1, kind: 'false-positive'}],
        [{justification: 'The configuration holds no shop data.', origin: 'agent'}],
        [
          {
            justification: 'The upgrade ships with the next release.',
            origin: 'file',
            entryIndex: 0,
            kind: 'accepted-risk',
          },
        ],
      ])
      expect(document.suppressions).toMatchObject({
        entryCount: 2,
        suppressedFindingCount: 2,
        entries: [
          {index: 0, check: 'EOL_API_VERSION', kind: 'accepted-risk', status: 'matched', matchedFindingCount: 1},
          {
            index: 1,
            check: 'CREDENTIAL_LOG_LEAKAGE',
            kind: 'false-positive',
            status: 'matched',
            matchedFindingCount: 1,
          },
        ],
      })
      expect(result.stderr).toBe('')
    })
  })

  test('without --json, --verbose shows the reason of the entry that suppresses a deterministic finding', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory, {deterministic: deterministicFindings})
      await writeSuppressions(appDirectory, suppressionEntries)

      const result = await runCommand(['--path', directory, '--verbose', '--check-id', 'EOL_API_VERSION'])

      expect(result.exitCode).toBe(0)
      const text = boxText(result.stderr)
      expect(text).toContain('deterministic · shopify.app.toml:8 (suppressed)')
      expect(text).toContain('Suppressed: The upgrade ships with the next release.')
    })
  })

  test('without --verbose, lists each suppressed finding with its kind and reason', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory, {deterministic: deterministicFindings, agent: agentFindings})
      await writeSuppressions(appDirectory, suppressionEntries)

      const result = await runCommand(['--path', directory])

      expect(result.exitCode).toBe(0)
      const text = boxText(result.stderr)
      expect(text).toContain('3 findings suppressed. 0 active · 3 suppressed')
      expect(text).toContain(
        'app/routes/orders.tsx:5 · agent · false positive · suppressions[1] The logger redacts tokens.',
      )
      expect(text).toContain('app/shopify.server.ts:3 · agent · suppressed by the agent')
      expect(text).toContain(
        'shopify.app.toml:8 · deterministic · accepted risk · suppressions[0] The upgrade ships with the next release.',
      )
      expect(text).not.toContain('Suppressed:')
    })
  })

  test('reports stale, ambiguous and not-evaluated entries, with a likely new path only while the old file is gone', async () => {
    await inTemporaryDirectory(async (directory) => {
      const [leak] = agentFindings.checks
      const secondLeak = {
        ...leak!.findings[0]!,
        location: {file: 'app/routes/orders.tsx', line: 9},
        message: 'The shop access token is written to the server log.',
      }
      const appDirectory = await createApp(directory, {
        deterministic: deterministicFindings,
        agent: {...agentFindings, checks: [{...leak!, findings: [...leak!.findings, secondLeak]}]},
      })
      const leakEntry = {...suppressionEntries[1]!, code: 'The session access token'}
      await writeSuppressions(appDirectory, [
        {...leakEntry, path: 'app/routes/old-orders.tsx'},
        {...leakEntry, code: 'access token is written to the server log'},
        {...leakEntry, check: 'UNAUTHENTICATED_ENDPOINT'},
        {...suppressionEntries[0], configurations: ['shopify.app.staging.toml']},
      ])

      const json = await runJsonCommand(['--path', directory])
      const text = await runCommand(['--path', directory])
      await mkdir(joinPath(appDirectory, 'app', 'routes'))
      await writeFile(joinPath(appDirectory, 'app', 'routes', 'old-orders.tsx'), 'export {}\n')
      const withOldFile = await runJsonCommand(['--path', directory])

      expect(json.exitCode).toBe(0)
      expect(JSON.parse(json.stdout).suppressions).toMatchObject({
        entryCount: 4,
        suppressedFindingCount: 0,
        staleEntryCount: 1,
        ambiguousEntryCount: 1,
        entries: [
          {
            status: 'stale',
            likelyPath: resolve(appDirectory, 'app', 'routes', 'orders.tsx'),
            candidateFindingCount: null,
          },
          {status: 'ambiguous', likelyPath: null, candidateFindingCount: 2},
          {status: 'not-evaluated', likelyPath: null, candidateFindingCount: null},
          {status: 'not-evaluated', likelyPath: null, candidateFindingCount: null},
        ],
      })
      const box = boxText(text.stderr)
      expect(box).toContain('2 entries in shopify.app-security.json suppress nothing.')
      expect(box).toContain(
        'suppressions[0]: agent CREDENTIAL_LOG_LEAKAGE in app/routes/old-orders.tsx · false positive The logger redacts tokens. Maybe moved to app/routes/orders.tsx',
      )
      expect(box).toContain(
        'suppressions[1]: agent CREDENTIAL_LOG_LEAKAGE in app/routes/orders.tsx · matches 2 findings At app/routes/orders.tsx:5, app/routes/orders.tsx:9',
      )
      expect(box).toContain(
        'Not evaluated: 2 entries (1 for a check without an executed result, 1 for other app configurations).',
      )
      expect(JSON.parse(withOldFile.stdout).suppressions.entries[0]).toMatchObject({status: 'stale', likelyPath: null})
    })
  })

  test('--json with an invalid shopify.app-security.json writes its error document', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory, {deterministic: deterministicFindings})
      await writeSuppressions(appDirectory, [{...suppressionEntries[0], check: 'NOT_A_CHECK'}])

      const result = await runJsonCommand(['--path', directory])

      expect(result.exitCode).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        error: {
          type: 'abort',
          message: 'The app security suppressions could not be loaded because shopify.app-security.json is invalid.',
          code: 'suppressions-file-invalid',
          details: {
            path: resolve(appDirectory, 'shopify.app-security.json'),
            errors: ['suppressions[0].check: not a known check ID'],
          },
        },
      })
      expect(result.stderr).toBe('')
    })
  })

  test('--json with an invalid results file writes one error document with every invalid file in its details', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory, {
        deterministic: agentFindings,
        agent: {...agentFindings, generated_at: 1},
      })

      const result = await runJsonCommand(['--path', directory])

      expect(result.exitCode).toBe(1)
      expect(JSON.parse(result.stdout)).toStrictEqual({
        error: {
          type: 'abort',
          message: 'The app security check results could not be loaded because both results files are invalid.',
          code: 'results-file-invalid',
          nextSteps: [
            expect.stringMatching(
              /^Run shopify app security check --path .+ to regenerate deterministic-findings\.json\.$/,
            ),
            expect.stringMatching(/^Have your coding agent run .+ again to regenerate agent-findings\.json\.$/),
            expect.stringMatching(/^Or run shopify app security clean --path .+ to delete both results files/),
          ],
          customSections: [
            {title: renderedResultsPath(appDirectory, 'deterministic-findings.json'), body: expect.any(String)},
            {title: renderedResultsPath(appDirectory, 'agent-findings.json'), body: expect.any(String)},
          ],
          details: {
            files: [
              {
                path: resultsPath(appDirectory, 'deterministic-findings.json'),
                errors: ['source is "agent", but this file must hold "deterministic" findings.'],
              },
              {
                path: resultsPath(appDirectory, 'agent-findings.json'),
                errors: ['generated_at: Expected string, received number'],
              },
            ],
          },
        },
      })
      expect(result.stderr).toBe('')
    })
  })

  test('--json with a hand-edited line 0 writes the invalid results file error document', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory, {deterministic: withZeroLine(deterministicFindings)})

      const result = await runJsonCommand(['--path', directory])

      expect(result.exitCode).toBe(1)
      expect(JSON.parse(result.stdout)).toStrictEqual({
        error: {
          type: 'abort',
          message: 'The app security check results could not be loaded because a results file is invalid.',
          code: 'results-file-invalid',
          nextSteps: [
            expect.stringMatching(
              /^Run shopify app security check --path .+ to regenerate deterministic-findings\.json\.$/,
            ),
            expect.stringMatching(/^Or run shopify app security clean --path .+ to delete both results files/),
          ],
          customSections: [
            {
              title: renderedResultsPath(appDirectory, 'deterministic-findings.json'),
              body: 'checks[0].findings[0].location.line: Number must be greater than 0',
            },
          ],
          details: {
            files: [
              {
                path: resultsPath(appDirectory, 'deterministic-findings.json'),
                errors: ['checks[0].findings[0].location.line: Number must be greater than 0'],
              },
            ],
          },
        },
      })
      expect(result.stderr).toBe('')
    })
  })

  test('without --json, a hand-edited line 0 renders the invalid results file error and exits 1', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory, {deterministic: withZeroLine(deterministicFindings)})

      const result = await runCommand(['--path', directory])

      expect(result.exitCode).toBe(1)
      expect(result.stdout).toBe('')
      const text = boxText(result.stderr)
      expect(text).toContain('The app security check results could not be loaded because a results file is invalid.')
      expect(text).toContain('checks[0].findings[0].location.line: Number must be greater than 0')
      expect(text).toContain('Run `shopify app security check')
    })
  })

  test('--json with unknown --check-id values writes one error document with only those IDs in its details', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory, {deterministic: deterministicFindings})

      const result = await runJsonCommand([
        '--path',
        directory,
        '--check-id',
        'NOT_A_CHECK',
        '--check-id',
        'EOL_API_VERSION',
        '--check-id',
        'ALSO_NOT_A_CHECK',
      ])

      expect(result.exitCode).toBe(1)
      expect(JSON.parse(result.stdout)).toStrictEqual({
        error: {
          type: 'abort',
          message: 'Unknown check IDs: NOT_A_CHECK, ALSO_NOT_A_CHECK.',
          code: 'unknown-check-id',
          tryMessage: 'Pass --check-id with one of the checks in the results files.',
          customSections: [{title: 'Available check IDs', body: expect.any(String)}],
          details: {checkIds: ['NOT_A_CHECK', 'ALSO_NOT_A_CHECK']},
        },
      })
      expect(result.stderr).toBe('')
    })
  })

  test('--json without a results directory writes one error document with its code', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory, null)

      const result = await runJsonCommand(['--path', directory])

      expect(result.exitCode).toBe(1)
      expect(JSON.parse(result.stdout)).toStrictEqual({
        error: {
          type: 'abort',
          message: `No app security check results for shopify.app in ${appDirectory}.`,
          code: 'results-directory-not-found',
          tryMessage: expect.stringMatching(/^Run `shopify app security check --path .+`\.$/),
        },
      })
      expect(result.stderr).toBe('')
    })
  })

  test('without --json, renders the review on stderr, nothing on stdout, and exits 1 when --blocking is breached', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory, {deterministic: deterministicFindings, agent: agentFindings})

      const result = await runCommand(['--path', directory, '--blocking', 'low'])

      expect(result.exitCode).toBe(1)
      expect(result.stdout).toBe('')
      const text = boxText(result.stderr)
      expect(text).toContain('High · CREDENTIAL_LOG_LEAKAGE · Credential reaches a log sink')
      expect(text).toContain('2 checks with findings.')
      expect(text).toContain('Blocking 2 checks at or above low (--blocking low).')
    })
  })
})

describe('app security review --suppress command boundary', () => {
  /** The deterministic results with the excerpts that `check` captures for the EOL_API_VERSION finding. */
  const deterministicWithExcerpts: DeterministicFindingsDocument = {
    ...deterministicFindings,
    checks: deterministicFindings.checks.map((check) => ({
      ...check,
      findings: check.findings.map((finding) =>
        check.id === 'EOL_API_VERSION'
          ? {
              ...finding,
              code_excerpt: [
                {line: 7, text: '[webhooks]'},
                {line: 8, text: 'api_version = "2024-01"'},
              ],
            }
          : finding,
      ),
    })),
  }
  const suppressFlags = ['--kind', 'accepted-risk', '--reason', 'The upgrade ships with the next release.']

  test('--json saves the entry, then writes the review with the finding suppressed and the saved entry', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory, {deterministic: deterministicWithExcerpts})
      const before = JSON.parse((await runJsonCommand(['--path', directory])).stdout)
      const eolFinding = before.checks[1].findings[0]

      const result = await runJsonCommand([
        '--path',
        directory,
        '--suppress',
        String(eolFinding.number),
        ...suppressFlags,
        '--results-digest',
        before.resultsDigest,
        '--blocking',
        'low',
      ])

      expect(eolFinding).toMatchObject({number: 2, message: 'api_version 2024-01 is past its support window.'})
      const document = JSON.parse(result.stdout)
      expect(result.stderr).toBe('')
      expect(document.savedSuppressions).toStrictEqual({
        filePath: resolve(appDirectory, 'shopify.app-security.json'),
        entries: [
          {
            index: 0,
            change: 'added',
            source: 'deterministic',
            check: 'EOL_API_VERSION',
            kind: 'accepted-risk',
            path: resolve(appDirectory, 'shopify.app.toml'),
            code: 'api_version = "2024-01"',
            reason: 'The upgrade ships with the next release.',
            configurations: ['shopify.app.toml'],
            findingNumber: 2,
          },
        ],
        companionFindingNumbers: [],
      })
      expect(document.checks[1].findings[0]).toMatchObject({
        number: 2,
        disposition: 'suppressed',
        suppression: {origin: 'file', entryIndex: 0, kind: 'accepted-risk'},
      })
      expect(document.resultsDigest).toBe(before.resultsDigest)
      // CREDENTIAL_LOG_LEAKAGE is still active, so --blocking low fails after the save.
      expect(document.blocking).toStrictEqual({level: 'low', blockedCheckCount: 1})
      expect(result.exitCode).toBe(1)
      await expect(readFile(appSecuritySuppressionsPath(appDirectory))).resolves.toBe(
        `${JSON.stringify(
          {
            schema_version: 1,
            suppressions: [
              {
                source: 'deterministic',
                check: 'EOL_API_VERSION',
                kind: 'accepted-risk',
                path: 'shopify.app.toml',
                code: 'api_version = "2024-01"',
                reason: 'The upgrade ships with the next release.',
                configurations: ['shopify.app.toml'],
              },
            ],
          },
          null,
          2,
        )}\n`,
      )
    })
  })

  test('without --json, renders the review with the finding suppressed, then what was saved', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory, {deterministic: deterministicWithExcerpts})

      const result = await runCommand(['--path', directory, '--suppress', '2', ...suppressFlags])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe('')
      const text = boxText(result.stderr)
      expect(text).toContain(
        'shopify.app.toml:8 · deterministic · accepted risk · suppressions[0] The upgrade ships with the next release.',
      )
      expect(text).toMatch(/Results digest: [0-9a-f]{12} \(pass it to --results-digest with --suppress\)/)
      expect(text).toContain('Saved 1 suppression to shopify.app-security.json.')
      expect(text).toContain('suppressions[0] · finding 2 · added deterministic EOL_API_VERSION in shopify.app.toml')
      expect(text).toContain('Next steps • Review and commit shopify.app-security.json.')
      expect(text.indexOf('Saved 1 suppression')).toBeGreaterThan(text.indexOf('Results digest'))
    })
  })

  test('--json with a stale --results-digest writes the error document and saves nothing', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory, {deterministic: deterministicWithExcerpts})
      const {resultsDigest} = JSON.parse((await runJsonCommand(['--path', directory])).stdout)

      const result = await runJsonCommand([
        '--path',
        directory,
        '--suppress',
        '2',
        ...suppressFlags,
        '--results-digest',
        'ffffffffffff',
      ])

      expect(result.exitCode).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        error: {
          type: 'abort',
          message:
            'The results changed since digest ffffffffffff, so the finding numbers may name other findings. Nothing was saved.',
          code: 'results-digest-mismatch',
          details: {resultsDigest},
        },
      })
      await expect(fileExists(appSecuritySuppressionsPath(appDirectory))).resolves.toBe(false)
    })
  })

  test('--json with an empty --reason writes the error document of the file validation and saves nothing', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory, {deterministic: deterministicWithExcerpts})

      const result = await runJsonCommand(['--path', directory, '--suppress', '2', '--kind', 'risk', '--reason', ' '])

      expect(result.exitCode).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        error: {
          code: 'suppression-flags-invalid',
          details: {errors: ['--kind: must be false-positive or accepted-risk', '--reason: must not be empty']},
        },
      })
      await expect(fileExists(appSecuritySuppressionsPath(appDirectory))).resolves.toBe(false)
    })
  })
})

describe('app security review --interactive command boundary', () => {
  /** Runs `check` with stdin, stdout and stderr reporting that they are terminals, then restores them. */
  async function inTerminal<T>(check: () => Promise<T>): Promise<T> {
    const streams = [process.stdin, process.stdout, process.stderr]
    const original = streams.map((stream) => Object.getOwnPropertyDescriptor(stream, 'isTTY'))
    streams.forEach((stream) => Object.defineProperty(stream, 'isTTY', {value: true, configurable: true}))
    try {
      return await check()
    } finally {
      streams.forEach((stream, index) => {
        const descriptor = original[index]
        if (descriptor) Object.defineProperty(stream, 'isTTY', descriptor)
        else Reflect.deleteProperty(stream, 'isTTY')
      })
    }
  }

  function expectUnavailable(result: Awaited<ReturnType<typeof runCommand>>) {
    expect(result.exitCode).toBe(1)
    const text = boxText(result.stderr)
    expect(text).toContain('The interactive review needs an interactive terminal.')
    expect(text).toContain('Run it in a terminal, outside CI and without --no-input.')
    // It fails before it reads the results, so no review and no prompt is shown.
    expect(text).not.toContain('CREDENTIAL_LOG_LEAKAGE')
    expect(text).not.toContain('What do you want to do')
  }

  test('without a terminal, fails before it reads anything, prompts nothing and saves nothing', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory, {deterministic: deterministicFindings, agent: agentFindings})

      const result = await runCommand(['--path', directory, '--interactive'])

      expectUnavailable(result)
      await expect(fileExists(appSecuritySuppressionsPath(appDirectory))).resolves.toBe(false)
    })
  })

  test('in CI or with --no-input, fails the same way in a terminal', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory, {deterministic: deterministicFindings, agent: agentFindings})

      vi.stubEnv('CI', 'true')
      try {
        expectUnavailable(await inTerminal(() => runCommand(['--path', directory, '--interactive'])))
      } finally {
        vi.unstubAllEnvs()
      }
      vi.stubEnv('CI', undefined)
      vi.stubEnv('SHOPIFY_FLAG_NO_INPUT', '1')
      try {
        expectUnavailable(await inTerminal(() => runCommand(['--path', directory, '--interactive'])))
      } finally {
        vi.unstubAllEnvs()
      }
    })
  })

  test('--json with --interactive writes the error document, prompts nothing and saves nothing', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory, {deterministic: deterministicFindings})

      const result = await runJsonCommand(['--path', directory, '--interactive'])

      expect(result.exitCode).not.toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        error: {message: expect.stringContaining('--json=true cannot also be provided when using --interactive')},
      })
      expect(result.stderr).not.toContain('What do you want to do')
      await expect(fileExists(appSecuritySuppressionsPath(appDirectory))).resolves.toBe(false)
    })
  })
})

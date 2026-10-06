import {
  appSecurityInstructionsPrompt,
  buildSecurityAlert,
  renderSecurityCheckPromptsNotice,
  renderSecurityCheckResult,
} from './security-output.js'
import {formatAppSecurityCommand, resolveAppSecurityCommands} from './app-security-commands.js'
import {appSecurityInstructions} from './app-security-instructions.js'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {unstyled} from '@shopify/cli-kit/node/output'
import {cwd, joinPath} from '@shopify/cli-kit/node/path'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {afterEach, describe, expect, test, vi} from 'vitest'
import type {AppSecurityInstructionsDestination, SecurityReportInput} from './security-output.js'
import type {AppSecurityExecution} from './app-security-api.js'
import type {SecurityCheckResolution, SecurityCheckResult} from './security-check.js'
import type {AppSecuritySelection} from './app-security-selection.js'
import type {
  AgentChecks,
  AppSecurityScope,
  DeterministicFindingsDocument,
  ScanResult,
} from './app-security-engine/index.js'

const appSelection: AppSecuritySelection = {
  kind: 'config',
  appDirectory: '/tmp/app',
  appConfigFilePath: '/tmp/app/shopify.app.toml',
  configClientId: 'toml-client-id',
}

const engine = {
  name: 'shopify-app-security',
  version: '1.2.3',
  ruleset: '2026.08.28',
}

const scanWithIssues: ScanResult = {
  version: '0.1.0',
  timestamp: '2026-08-24T00:00:00.000Z',
  app: {name: 'Example App', type: 'public'},
  detection: {
    framework: 'react_router',
    surface: 'react_router',
    languages: [{name: 'typescript', support: 'supported', files: ['app/routes/action.ts']}],
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
    timestamp: '2026-08-24T00:00:00.000Z',
    security_version: '0.1.0',
    files_scanned: 12,
    rules_run: 18,
    rules_skipped: 0,
    files_skipped_count: 0,
    coverage_gaps: [],
    checks_executed: [],
  },
  issues: [
    {
      id: 'REQUEST_CONTROLLED_ADMIN_CONTEXT',
      severity: 'high',
      points: -30,
      title: 'Request input selects Admin API shop context',
      message: 'A request-controlled shop value is passed to unauthenticated.admin(...).',
      location: {file: 'app/routes/action.ts', line: 42},
      fix: {
        automated: false,
        description: 'Use authenticate.admin(request).',
      },
    },
    {
      id: 'EOL_API_VERSION',
      severity: 'high',
      points: -10,
      title: 'Configured API version is no longer supported',
      message: 'The configured API version is outside the supported window.',
      location: {file: 'shopify.app.toml'},
      fix: {automated: false, description: 'Upgrade to a supported API version.'},
    },
  ],
}

function reportInput(overrides: Partial<SecurityReportInput> = {}): SecurityReportInput {
  return {
    scan: scanWithIssues,
    selection: appSelection,
    scanDirectories: [{directory: '/tmp/app', origin: 'app_directory'}],
    engine,
    verbose: false,
    elapsedMilliseconds: 125,
    commands: resolveAppSecurityCommands(appSelection, cwd()),
    deterministicFindingsPath: '/tmp/app/.shopify/app-security/deterministic-findings.json',
    agentChecksPath: '/tmp/app/.shopify/app-security/agent-checks.json',
    agentCheckCount: 31,
    ...overrides,
  }
}

function section(input: SecurityReportInput, title: string) {
  return buildSecurityAlert(input).options.customSections?.find((entry) => entry.title === title)
}

function selectionRows(selection: AppSecuritySelection) {
  return section(reportInput({selection}), 'Selection')?.body
}

describe('buildSecurityAlert', () => {
  test('shows the app directory, the config file, the client ID and the scan directories', () => {
    expect(selectionRows(reportInput().selection)).toEqual({
      tabularData: [
        ['App directory', '/tmp/app'],
        ['Config file', 'shopify.app.toml'],
        ['Client ID', 'toml-client-id'],
        ['Scan directories', '.'],
      ],
      firstColumnSubdued: true,
    })
  })

  test('says where the client ID came from when --client-id overrides the TOML', () => {
    const rows = selectionRows({
      kind: 'config',
      appDirectory: '/tmp/app',
      appConfigFilePath: '/tmp/app/shopify.app.staging.toml',
      configClientId: 'toml-client-id',
      clientIdOverride: 'flag-client-id',
    })

    expect(rows).toMatchObject({
      tabularData: expect.arrayContaining([
        ['Config file', 'shopify.app.staging.toml'],
        ['Client ID', 'flag-client-id (from --client-id)'],
      ]),
    })
  })

  test('shows an unlinked configuration as not linked', () => {
    const rows = selectionRows({
      kind: 'config',
      appDirectory: '/tmp/app',
      appConfigFilePath: '/tmp/app/shopify.app.toml',
    })

    expect(rows).toMatchObject({tabularData: expect.arrayContaining([['Client ID', 'not linked']])})
  })

  test('shows no config file when scanning without app configuration', () => {
    const rows = selectionRows({
      kind: 'no-config',
      appDirectory: '/tmp/app',
      clientId: 'chosen-id',
      clientIdSource: 'picker',
    })

    expect(rows).toMatchObject({
      tabularData: expect.arrayContaining([
        ['Config file', 'none'],
        ['Client ID', 'chosen-id'],
      ]),
    })
  })

  test('renders a concise grouped error report for high-severity issues', () => {
    const alert = buildSecurityAlert(reportInput())
    const serialized = JSON.stringify(alert)

    expect(alert.type).toBe('error')
    expect(alert.options.headline).toBe('2 security issues found.')
    expect(serialized).toContain('12 files scanned in 125ms')
    expect(serialized).toContain('Example App')
    expect(serialized).toContain('REQUEST_CONTROLLED_ADMIN_CONTEXT')
    expect(serialized).toContain('app/routes/action.ts:42')
    expect(serialized).not.toContain('Fix: Use authenticate.admin(request).')
    expect(section(reportInput(), 'High')?.body).toEqual({
      list: {
        items: [
          [
            {bold: 'Request input selects Admin API shop context'},
            {
              link: {
                label: 'REQUEST_CONTROLLED_ADMIN_CONTEXT',
                url: 'https://shopify.dev/docs/apps/build/security/app-security-checks/request-controlled-admin-context',
              },
            },
            '1 occurrence across 1 file',
            {filePath: 'app/routes/action.ts:42'},
          ],
          [
            {bold: 'Configured API version is no longer supported'},
            {
              link: {
                label: 'EOL_API_VERSION',
                url: 'https://shopify.dev/docs/apps/build/security/app-security-checks/eol-api-version',
              },
            },
            '1 occurrence across 1 file',
            {filePath: 'shopify.app.toml'},
          ],
        ],
      },
    })
    const commands = resolveAppSecurityCommands(appSelection, cwd())
    expect(alert.options.nextSteps).toBeUndefined()
    expect(serialized).toContain('31 checks ready for your coding agent.')
    const customSections = alert.options.customSections ?? []
    const artifactsIndex = customSections.findIndex((entry) => entry.title === 'Artifacts')
    expect(customSections[artifactsIndex]?.body).toEqual({
      list: {
        items: [
          ['Deterministic findings:', {filePath: '.shopify/app-security/deterministic-findings.json'}],
          ['Agent security check instructions:', {filePath: '.shopify/app-security/agent-checks.json'}],
        ],
      },
    })
    expect(customSections[artifactsIndex + 1]).toEqual({
      title: 'Next steps',
      body: {
        list: {
          items: [
            ['Have your coding agent run the agent checks'],
            ['Record the agent results with', {command: formatAppSecurityCommand(commands.record)}],
            ['Review the results with', {command: formatAppSecurityCommand(commands.review)}],
          ],
          ordered: true,
        },
      },
    })
    expect(alert.options.reference).toEqual([
      {subdued: 'Engine: shopify-app-security 1.2.3'},
      {subdued: 'Ruleset: 2026.08.28'},
    ])
  })

  test('collapses hundreds of occurrences without hiding their reach or changing severity', () => {
    const issues = Array.from({length: 200}, (_, index) => ({
      ...scanWithIssues.issues[0]!,
      location: {file: `app/routes/route-${String(index).padStart(3, '0')}.ts`, line: 42},
    }))
    const input = reportInput({scan: {...scanWithIssues, issues}})
    const before = structuredClone(input.scan)
    const alert = buildSecurityAlert(input)
    const high = section(input, 'High')!

    expect(alert.type).toBe('error')
    expect(alert.options.headline).toBe('1 security issue group found (200 occurrences).')
    expect(high.body).toEqual({
      list: {
        items: [
          [
            {bold: issues[0]!.title},
            {
              link: {
                label: issues[0]!.id,
                url: 'https://shopify.dev/docs/apps/build/security/app-security-checks/request-controlled-admin-context',
              },
            },
            '200 occurrences across 200 files',
            {filePath: 'app/routes/route-000.ts:42'},
            {filePath: 'app/routes/route-001.ts:42'},
            {filePath: 'app/routes/route-002.ts:42'},
            {subdued: '+197 more files'},
          ],
        ],
      },
    })
    expect(JSON.stringify(alert)).toContain('Use --verbose')
    expect(input.scan).toEqual(before)
    expect(buildSecurityAlert({...input, scan: {...input.scan, issues: [...issues].reverse()}})).toEqual(alert)
  })

  test('samples distinct files, not just the first three occurrences', () => {
    const issues = [
      {file: 'app/a.ts', line: 1},
      {file: 'app/a.ts', line: 2},
      {file: 'app/a.ts', line: 3},
      {file: 'app/b.ts', line: 4},
      {file: 'app/c.ts', line: 5},
    ].map((location) => ({...scanWithIssues.issues[0]!, location}))
    const input = reportInput({scan: {...scanWithIssues, issues}})
    const serialized = JSON.stringify(section(input, 'High'))
    expect(serialized).toContain('5 occurrences across 3 files')
    expect(serialized).toContain('app/a.ts:1')
    expect(serialized).toContain('app/b.ts:4')
    expect(serialized).toContain('app/c.ts:5')
    expect(serialized).not.toContain('app/a.ts:2')
  })

  test('verbose output expands every occurrence, including distinct messages and fixes', () => {
    const issues = Array.from({length: 4}, (_, index) => ({
      ...scanWithIssues.issues[0]!,
      location: {file: 'app/a.ts', line: index + 1},
      message: `Evidence ${index}`,
      fix: {automated: false, description: `Remediation ${index}`},
    }))
    const input = reportInput({verbose: true, scan: {...scanWithIssues, issues}})
    const serialized = JSON.stringify(section(input, 'High'))
    expect(serialized).toContain('4 occurrences across 1 file')
    for (const [index, issue] of issues.entries()) {
      expect(serialized).toContain(`app/a.ts:${index + 1}`)
      expect(serialized).toContain(issue.message)
      expect(serialized).toContain(`Fix: ${issue.fix.description}`)
    }
  })

  test.each(['low', 'medium'] as const)('does not promote widespread %s findings', (severity) => {
    const issues = Array.from({length: 200}, (_, index) => ({
      ...scanWithIssues.issues[0]!,
      severity,
      location: {file: `app/${index}.ts`},
    }))
    const input = reportInput({scan: {...scanWithIssues, issues}})
    expect(buildSecurityAlert(input).type).toBe('warning')
    expect(section(input, 'High')).toBeUndefined()
  })

  test('quotes record commands for Windows paths with spaces and percents', () => {
    const commands = resolveAppSecurityCommands(appSelection, joinPath(cwd(), '50% my app'))
    const alert = buildSecurityAlert(reportInput({commands}))
    const recordCommand = formatAppSecurityCommand(commands.record)

    expect(alert.options.nextSteps).toBeUndefined()
    expect(section(reportInput({commands}), 'Next steps')?.body).toEqual({
      list: {
        items: [
          ['Have your coding agent run the agent checks'],
          ['Record the agent results with', {command: recordCommand}],
          ['Review the results with', {command: formatAppSecurityCommand(commands.review)}],
        ],
        ordered: true,
      },
    })
    expect(recordCommand).not.toContain('50%%')
    expect(formatAppSecurityCommand(commands.record, 'cmd')).toContain('^%')
    expect(formatAppSecurityCommand(commands.record, 'powershell')).toContain("'50% my app'")
  })

  test('adds evidence, fix guidance, and scan details in verbose mode', () => {
    const serialized = JSON.stringify(buildSecurityAlert(reportInput({verbose: true})))

    expect(serialized).toContain('Fix: Use authenticate.admin(request).')
    expect(serialized).toContain('Capabilities')
    expect(serialized).toContain('has_backend')
    expect(serialized).toContain('Rules run')
    expect(section(reportInput({verbose: true}), 'Scan details')).toBeDefined()
  })

  test('uses a success banner when coverage is complete and no issues were found', () => {
    const alert = buildSecurityAlert(
      reportInput({
        scan: {
          ...scanWithIssues,
          issues: [],
        },
      }),
    )

    expect(alert.type).toBe('success')
    expect(alert.options.headline).toBe('No security issues found.')
  })

  test('warns when coverage is incomplete even if no issues were found', () => {
    const input = reportInput({
      scan: {
        ...scanWithIssues,
        issues: [],
        detection: {...scanWithIssues.detection, framework: 'unknown', surface: 'unknown'},
        scan: {
          ...scanWithIssues.scan,
          coverage_gaps: [{code: 'unsupported_framework', message: 'Backend could not be classified.'}],
        },
      },
    })
    const alert = buildSecurityAlert(input)
    const serialized = JSON.stringify(alert)

    expect(alert.type).toBe('warning')
    expect(alert.options.headline).toBe('Scan completed with coverage gaps.')
    expect(serialized).toContain('Backend could not be classified.')
    expect(section(input, 'Coverage gaps')).toBeDefined()
  })

  test('uses a warning banner for medium-severity issues', () => {
    const input = reportInput({
      scan: {
        ...scanWithIssues,
        issues: [{...scanWithIssues.issues[0]!, severity: 'medium', points: -5}],
      },
    })
    const alert = buildSecurityAlert(input)

    expect(alert.type).toBe('warning')
    expect(alert.options.headline).toBe('1 security issue found.')
    expect(section(input, 'Medium')).toBeDefined()
  })

  test('links check IDs to their docs pages in every occurrence, apart from the guide, and leaves unknown IDs unlinked', () => {
    const guide = 'https://shopify.dev/docs/api/usage/versioning'
    const issues = [
      {...scanWithIssues.issues[1]!, fix: {automated: false, description: 'Upgrade.', guide}},
      {...scanWithIssues.issues[1]!, id: 'UNKNOWN_CHECK', title: 'Unknown check'},
    ]
    const serialized = JSON.stringify(section(reportInput({verbose: true, scan: {...scanWithIssues, issues}}), 'High'))
    const eolLink = JSON.stringify({
      link: {
        label: 'EOL_API_VERSION',
        url: 'https://shopify.dev/docs/apps/build/security/app-security-checks/eol-api-version',
      },
    })

    // Once in the group and once in its occurrence.
    expect(serialized.split(eolLink)).toHaveLength(3)
    expect(serialized).toContain(JSON.stringify({link: {label: 'Guide', url: guide}}))
    expect(serialized).toContain(JSON.stringify({subdued: 'UNKNOWN_CHECK'}))
    expect(serialized).not.toContain('"label":"UNKNOWN_CHECK"')
  })

  test('renders engine-redacted titles, paths, and verbose evidence unchanged', () => {
    const serialized = JSON.stringify(
      buildSecurityAlert(
        reportInput({
          verbose: true,
          scan: {
            ...scanWithIssues,
            app: {name: 'app [REDACTED: Shopify token]', type: 'public'},
            issues: [
              {
                ...scanWithIssues.issues[0]!,
                title: 'title [REDACTED: Shopify token]',
                message: 'message [REDACTED: Shopify token]',
                snippet: 'snippet [REDACTED: Shopify token]',
                fix: {
                  automated: false,
                  description: 'fix [REDACTED: Shopify token]',
                  guide: 'https://example.com/[REDACTED: Shopify token]',
                },
              },
            ],
          },
        }),
      ),
    )

    expect(serialized).toContain('[REDACTED: Shopify token]')
    expect(serialized).not.toContain('shpat_')
  })
})

const deterministicFindings: DeterministicFindingsDocument = {
  schema_version: 1,
  source: 'deterministic',
  engine: {name: 'shopify-app-security', version: '1.2.3', ruleset: '2026.08.28'},
  generated_at: '2026-08-24T00:00:00.000Z',
  detection: scanWithIssues.detection,
  coverage: {
    files_scanned: 12,
    files_skipped: [],
    gaps: [],
    scope: {include_dirs: [], excludes: [], no_git_ignore: false},
    scan_directories: [{directory: '.', origin: 'app_directory'}],
  },
  checks: [],
}

const agentChecks: AgentChecks = {
  schema_version: 1,
  engine: {name: 'shopify-app-security', version: '1.2.3'},
  generated_at: '2026-08-24T00:00:00.000Z',
  checks: Array.from({length: 31}, (_, index) => ({
    id: `CHECK_${index}`,
    version: 1,
    prompt: 'prompt',
    severity: 'medium' as const,
    docs_url: `https://shopify.dev/docs/apps/build/security/app-security-checks/check-${index}`,
  })),
  instructions: 'review',
}

const cleanExecution: AppSecurityExecution = {
  scan: {...scanWithIssues, issues: []},
  ignoredScanDirectories: [],
  deterministicFindings,
  agentChecks,
  engine,
  elapsedMilliseconds: 125,
}

const checkArtifacts = {
  deterministicFindingsPath: '/tmp/app/.shopify/app-security/shopify.app/deterministic-findings.json',
  agentChecksPath: '/tmp/app/.shopify/app-security/shopify.app/agent-checks.json',
}

const noScope: AppSecurityScope = {include_dirs: [], excludes: [], no_git_ignore: false}

function checkResolution(scope: AppSecurityScope = noScope): SecurityCheckResolution {
  return {
    selection: appSelection,
    resultsKey: 'shopify.app',
    commands: resolveAppSecurityCommands(appSelection, cwd(), scope),
    scope,
    includeDirectories: [],
    prompted: false,
  }
}

function scanResult(
  overrides: {execution?: AppSecurityExecution; resolution?: SecurityCheckResolution} = {},
): SecurityCheckResult {
  return {
    kind: 'scan',
    resolution: overrides.resolution ?? checkResolution(),
    scanDirectories: [{directory: '/tmp/app', origin: 'app_directory'}],
    execution: overrides.execution ?? cleanExecution,
    artifacts: checkArtifacts,
  }
}

function fileListResult(paths: string[], ignoredScanDirectories: string[] = []): SecurityCheckResult {
  return {kind: 'file-list', resolution: checkResolution(), paths, ignoredScanDirectories}
}

/** The instructions `check` offers after a scan of `checkResolution(scope)`. */
function postScanInstructions(scope: AppSecurityScope = noScope): string {
  const {selection, resultsKey, commands} = checkResolution(scope)
  return appSecurityInstructions({appDirectory: selection.appDirectory, resultsKey, commands, scanScope: scope})
}

function renderOptions(overrides: Partial<Parameters<typeof renderSecurityCheckResult>[1]> = {}) {
  return {
    format: 'text' as const,
    verbose: false,
    blocking: 'none' as const,
    yes: false,
    skipInstructions: false,
    canPrompt: false,
    ...overrides,
  }
}

function renderDependencies(destination: AppSecurityInstructionsDestination = 'nothing') {
  return {
    selectInstructionsDestination: vi.fn(async (_agentCheckCount: number) => destination),
    deliverInstructions: vi.fn(async (_content: string, _delivery: {copy: boolean}) => {}),
    setExitCode: vi.fn(),
  }
}

interface CapturedStreams {
  stdout(): string
  stderr(): string
}

/** Runs `render` as a command in `format` would, with the real output writers, and captures both streams. */
async function captureOutput(format: 'json' | 'text', render: (streams: CapturedStreams) => Promise<void> | void) {
  return withCapturedStandardStreams(async (streams) => {
    await runWithCommandEventsForCommand(format === 'json' ? ['--json'] : [], () => render(streams))
    return {stdout: streams.stdout(), stderr: streams.stderr()}
  })
}

function renderCheck(
  result: SecurityCheckResult,
  options: ReturnType<typeof renderOptions>,
  dependencies: ReturnType<typeof renderDependencies>,
) {
  return captureOutput(options.format, () => renderSecurityCheckResult(result, options, dependencies))
}

/** Every line on stderr parsed as a side event: in JSON mode nothing else may be written there. */
function sideEvents(stderr: string): unknown[] {
  return stderr
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line))
}

/** Banner text with its styling and frame removed, so a wrapped line reads as one sentence. */
function bannerText(stderr: string): string {
  return unstyled(stderr)
    .replaceAll(/[│╭╮╰╯─]/g, ' ')
    .replaceAll(/\s+/g, ' ')
}

describe('renderSecurityCheckResult', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('prints one JSON document on stdout with the instructions --yes chose, and nothing on stderr', async () => {
    const dependencies = renderDependencies()

    const {stdout, stderr} = await renderCheck(scanResult(), renderOptions({format: 'json', yes: true}), dependencies)

    expect(JSON.parse(stdout)).toEqual({
      selection: {
        directory: '/tmp/app',
        configPath: '/tmp/app/shopify.app.toml',
        clientId: 'toml-client-id',
        clientIdSource: 'config',
        scanDirectories: [{directory: '/tmp/app', origin: 'app-directory'}],
      },
      deterministicFindings,
      agentChecksPath: checkArtifacts.agentChecksPath,
      instructions: {content: postScanInstructions(), copiedToClipboard: false, path: null},
    })
    expect(stderr).toBe('')
    expect(dependencies.selectInstructionsDestination).not.toHaveBeenCalled()
    expect(dependencies.deliverInstructions).toHaveBeenCalledWith(postScanInstructions(), {copy: false})
  })

  test('asks for the instructions before printing the JSON result, and puts the copied instructions in it', async () => {
    const dependencies = renderDependencies()
    let stdoutWhenAsked: string | undefined

    const {stdout} = await captureOutput('json', async (streams) => {
      dependencies.selectInstructionsDestination.mockImplementation(async () => {
        stdoutWhenAsked = streams.stdout()
        return 'copy'
      })
      await renderSecurityCheckResult(scanResult(), renderOptions({format: 'json', canPrompt: true}), dependencies)
    })

    expect(stdoutWhenAsked).toBe('')
    expect(dependencies.selectInstructionsDestination).toHaveBeenCalledWith(31)
    expect(dependencies.deliverInstructions).toHaveBeenCalledWith(postScanInstructions(), {copy: true})
    expect(JSON.parse(stdout).instructions).toEqual({
      content: postScanInstructions(),
      copiedToClipboard: true,
      path: null,
    })
  })

  test.each([
    ['no instructions are chosen', {canPrompt: true, skipInstructions: false}],
    ['--skip-instructions is passed', {canPrompt: true, skipInstructions: true}],
    ['the terminal is not interactive', {canPrompt: false, skipInstructions: false}],
  ])('puts null instructions in the JSON result when %s', async (_, {canPrompt, skipInstructions}) => {
    const dependencies = renderDependencies('nothing')

    const {stdout} = await renderCheck(
      scanResult(),
      renderOptions({format: 'json', canPrompt, skipInstructions}),
      dependencies,
    )

    expect(dependencies.deliverInstructions).not.toHaveBeenCalled()
    expect(JSON.parse(stdout).instructions).toBeNull()
  })

  test('renders the report on stderr, then offers the instructions and prints the chosen ones on stdout', async () => {
    const dependencies = renderDependencies()
    let stderrWhenAsked: string | undefined

    const {stdout, stderr} = await captureOutput('text', async (streams) => {
      dependencies.selectInstructionsDestination.mockImplementation(async () => {
        stderrWhenAsked = streams.stderr()
        return 'print'
      })
      await renderSecurityCheckResult(scanResult(), renderOptions({canPrompt: true}), dependencies)
    })

    expect(bannerText(stderrWhenAsked ?? '')).toContain('No security issues found.')
    expect(bannerText(stderr)).toContain(
      'Agent security check instructions: .shopify/app-security/shopify.app/agent-checks.json',
    )
    expect(dependencies.deliverInstructions).toHaveBeenCalledWith(postScanInstructions(), {copy: false})
    expect(stdout).toBe(`${postScanInstructions()}\n`)
  })

  test('confirms copied instructions without printing them', async () => {
    const dependencies = renderDependencies('copy')

    const {stdout, stderr} = await renderCheck(scanResult(), renderOptions({canPrompt: true}), dependencies)

    expect(dependencies.deliverInstructions).toHaveBeenCalledWith(postScanInstructions(), {copy: true})
    expect(bannerText(stderr)).toContain('Copied app security check instructions to the clipboard')
    expect(stdout).toBe('')
  })

  test('--yes prints the instructions without prompting, including in CI', async () => {
    const dependencies = renderDependencies()

    const {stdout} = await renderCheck(scanResult(), renderOptions({yes: true}), dependencies)

    expect(dependencies.selectInstructionsDestination).not.toHaveBeenCalled()
    expect(stdout).toBe(`${postScanInstructions()}\n`)
  })

  test.each([
    ['in CI or another non-interactive environment', {canPrompt: false, skipInstructions: false}],
    ['with --skip-instructions', {canPrompt: true, skipInstructions: true}],
  ])('does not offer the instructions %s', async (_, {canPrompt, skipInstructions}) => {
    const dependencies = renderDependencies('print')

    const {stdout} = await renderCheck(scanResult(), renderOptions({canPrompt, skipInstructions}), dependencies)

    expect(dependencies.selectInstructionsDestination).not.toHaveBeenCalled()
    expect(dependencies.deliverInstructions).not.toHaveBeenCalled()
    expect(stdout).toBe('')
  })

  test('builds the instructions from the exact scope and the commands of the run', async () => {
    const scope = {include_dirs: ['backend', './backend/'], excludes: ['**/generated', '!keep'], no_git_ignore: true}

    const {stdout} = await renderCheck(
      scanResult({resolution: checkResolution(scope)}),
      renderOptions({format: 'json', yes: true}),
      renderDependencies(),
    )

    const {content} = JSON.parse(stdout).instructions
    expect(content).toBe(postScanInstructions(scope))
    expect(content).toContain(JSON.stringify(scope))
  })

  test('warns once for each scan directory that Git ignores, relative to the working directory', async () => {
    vi.stubEnv('INIT_CWD', '/tmp')

    const {stderr} = await renderCheck(
      scanResult({execution: {...cleanExecution, ignoredScanDirectories: ['/tmp/app', '/tmp']}}),
      renderOptions(),
      renderDependencies(),
    )

    const text = bannerText(stderr)
    expect(text.match(/is ignored by Git/g)).toHaveLength(2)
    expect(text).toContain('app is ignored by Git, so only the files Git tracks in it are scanned.')
    expect(text).toContain('. is ignored by Git, so only the files Git tracks in it are scanned.')
  })

  test('warns about an ignored scan directory as a diagnostic event with --json, keeping stdout one document', async () => {
    vi.stubEnv('INIT_CWD', '/tmp')

    const {stdout, stderr} = await renderCheck(
      scanResult({execution: {...cleanExecution, ignoredScanDirectories: ['/tmp/app']}}),
      renderOptions({format: 'json'}),
      renderDependencies(),
    )

    expect(sideEvents(stderr)).toEqual([
      expect.objectContaining({
        type: 'diagnostic',
        level: 'warning',
        message:
          'app is ignored by Git, so only the files Git tracks in it are scanned. Use --no-git-ignore to scan everything in it.',
      }),
    ])
    expect(JSON.parse(stdout)).toHaveProperty('agentChecksPath')
  })

  test.each(['text', 'json'] as const)('sets a blocking exit code from the findings (%s)', async (format) => {
    const dependencies = renderDependencies()

    await renderCheck(
      scanResult({execution: {...cleanExecution, scan: scanWithIssues}}),
      renderOptions({format, blocking: 'high'}),
      dependencies,
    )

    expect(dependencies.setExitCode).toHaveBeenCalledWith(1)
  })

  test('keeps the default exit code when no finding reaches the blocking level', async () => {
    const dependencies = renderDependencies()

    await renderCheck(scanResult(), renderOptions({blocking: 'low'}), dependencies)

    expect(dependencies.setExitCode).not.toHaveBeenCalled()
  })
})

describe('renderSecurityCheckResult --list-files', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('prints each gathered path on its own line, relative to the app directory, and nothing else', async () => {
    const dependencies = renderDependencies('print')

    const {stdout, stderr} = await renderCheck(
      fileListResult(['../backend/server.ts', 'app/routes/index.ts', 'shopify.app.toml']),
      renderOptions({canPrompt: true}),
      dependencies,
    )

    expect(stdout).toBe('../backend/server.ts\napp/routes/index.ts\nshopify.app.toml\n')
    expect(stderr).toBe('')
    expect(dependencies.selectInstructionsDestination).not.toHaveBeenCalled()
    expect(dependencies.setExitCode).not.toHaveBeenCalled()
  })

  test('prints the absolute paths as one JSON document with --json', async () => {
    const {stdout, stderr} = await renderCheck(
      fileListResult(['../backend/server.ts', 'shopify.app.toml']),
      renderOptions({format: 'json'}),
      renderDependencies(),
    )

    expect(JSON.parse(stdout)).toEqual({files: ['/tmp/backend/server.ts', joinPath('/tmp/app', 'shopify.app.toml')]})
    expect(stderr).toBe('')
  })

  test.each([
    ['text', ''],
    ['json', '{\n  "files": []\n}\n'],
  ] as const)('prints nothing for no gathered file, and an empty list with --json (%s)', async (format, expected) => {
    const {stdout} = await renderCheck(fileListResult([]), renderOptions({format}), renderDependencies())

    expect(stdout).toBe(expected)
  })

  test.each(['text', 'json'] as const)('warns about an ignored scan directory (%s)', async (format) => {
    vi.stubEnv('INIT_CWD', '/tmp')

    const {stderr} = await renderCheck(
      fileListResult(['shopify.app.toml'], ['/tmp/app']),
      renderOptions({format}),
      renderDependencies(),
    )

    if (format === 'json') {
      expect(sideEvents(stderr)).toEqual([expect.objectContaining({type: 'diagnostic', level: 'warning'})])
    } else {
      expect(bannerText(stderr)).toContain('app is ignored by Git, so only the files Git tracks in it are scanned.')
    }
  })
})

describe('renderSecurityCheckPromptsNotice', () => {
  const commands = checkResolution().commands

  test('shows the command that skips the prompts in a banner', async () => {
    const {stdout, stderr} = await captureOutput('text', () => renderSecurityCheckPromptsNotice(commands, 'text'))

    expect(bannerText(stderr)).toContain(
      `To skip these prompts next time, run: \`${formatAppSecurityCommand(commands.scan)}\``,
    )
    expect(stdout).toBe('')
  })

  test('shows the command that skips the prompts as a diagnostic event with --json', async () => {
    const {stdout, stderr} = await captureOutput('json', () => renderSecurityCheckPromptsNotice(commands, 'json'))

    expect(sideEvents(stderr)).toEqual([
      expect.objectContaining({
        type: 'diagnostic',
        level: 'info',
        message: `To skip these prompts next time, run: ${formatAppSecurityCommand(commands.scan)}`,
      }),
    ])
    expect(stdout).toBe('')
  })
})

describe('appSecurityInstructionsPrompt', () => {
  test('prioritizes copying instructions for the recommended agent checks', () => {
    expect(appSecurityInstructionsPrompt(31)).toEqual({
      message:
        '31 recommended agent checks available to complete your scan. How do you want to pass that prompt to your agent?',
      choices: [
        {label: 'Copy instructions to the clipboard', value: 'copy'},
        {label: 'Print instructions to the terminal', value: 'print'},
        {label: 'Nothing', value: 'nothing'},
      ],
      defaultValue: 'copy',
    })
  })

  test('names a single recommended agent check in the singular', () => {
    expect(appSecurityInstructionsPrompt(1).message).toBe(
      '1 recommended agent check available to complete your scan. How do you want to pass that prompt to your agent?',
    )
  })
})

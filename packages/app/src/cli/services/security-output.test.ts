import {buildSecurityAlert} from './security-output.js'
import {formatAppSecurityCommand, resolveAppSecurityCommands} from './app-security-commands.js'
import {cwd, joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import type {SecurityReportInput} from './security-output.js'
import type {AppSecuritySelection} from './app-security-selection.js'
import type {ScanResult} from './app-security-engine/index.js'

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

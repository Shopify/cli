import {buildDoctorAlert} from './doctor-output.js'
import {formatAppDoctorCommand, resolveAppDoctorCommands} from './app-doctor-commands.js'
import {describe, expect, test} from 'vitest'
import type {DoctorReportInput} from './doctor-output.js'
import type {ScanResult} from './app-doctor-engine/index.js'

const engine = {
  name: 'shopify-app-doctor',
  version: '1.2.3',
  ruleset: '2026.08.28',
}

const scanWithIssues: ScanResult = {
  version: '0.1.0',
  timestamp: '2026-08-24T00:00:00.000Z',
  project: {commit: null, dirty: null},
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
  score: {total: 40, baseline: 100, grade: 'POOR'},
  scan: {
    timestamp: '2026-08-24T00:00:00.000Z',
    doctor_version: '0.1.0',
    files_scanned: 12,
    rules_run: 18,
    rules_skipped: 0,
    files_skipped_count: 0,
    coverage_complete: true,
    coverage_gaps: [],
    input_hash: 'sha256:input',
    result_hash: 'sha256:result',
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

function reportInput(overrides: Partial<DoctorReportInput> = {}): DoctorReportInput {
  return {
    scan: scanWithIssues,
    engine,
    verbose: false,
    elapsedMilliseconds: 125,
    commands: resolveAppDoctorCommands('/tmp/app'),
    tracePath: '/tmp/app/.shopify/app-doctor/trace.json',
    reviewPath: '/tmp/app/.shopify/app-doctor/review.json',
    reviewCheckCount: 31,
    ...overrides,
  }
}

function section(input: DoctorReportInput, title: string) {
  return buildDoctorAlert(input).options.customSections?.find((entry) => entry.title === title)
}

describe('buildDoctorAlert', () => {
  test('renders a concise grouped error report for high-severity issues', () => {
    const alert = buildDoctorAlert(reportInput())
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
            {subdued: 'REQUEST_CONTROLLED_ADMIN_CONTEXT'},
            '1 occurrence across 1 file',
            {filePath: 'app/routes/action.ts:42'},
          ],
          [
            {bold: 'Configured API version is no longer supported'},
            {subdued: 'EOL_API_VERSION'},
            '1 occurrence across 1 file',
            {filePath: 'shopify.app.toml'},
          ],
        ],
      },
    })
    expect(alert.options.nextSteps).toEqual([
      [
        'Investigate the review pack, then compile the trace with',
        {command: formatAppDoctorCommand(resolveAppDoctorCommands('/tmp/app').compile)},
      ],
    ])
    expect(section(reportInput(), 'Artifacts')?.body).toEqual({
      list: {
        items: [
          ['Review pack:', {filePath: '/tmp/app/.shopify/app-doctor/review.json'}],
          ['Trace:', {filePath: '/tmp/app/.shopify/app-doctor/trace.json'}],
        ],
      },
    })
    expect(alert.options.reference).toEqual([
      {subdued: 'Engine: shopify-app-doctor 1.2.3'},
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
    const alert = buildDoctorAlert(input)
    const high = section(input, 'High')!

    expect(alert.type).toBe('error')
    expect(alert.options.headline).toBe('1 security issue group found (200 occurrences).')
    expect(high.body).toEqual({
      list: {
        items: [
          [
            {bold: issues[0]!.title},
            {subdued: issues[0]!.id},
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
    expect(JSON.stringify(section(input, 'Systemic patterns'))).toContain('shared helper')
    expect(input.scan).toEqual(before)
    expect(buildDoctorAlert({...input, scan: {...input.scan, issues: [...issues].reverse()}})).toEqual(alert)
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
    expect(section(input, 'Systemic patterns')).toBeUndefined()
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
    expect(buildDoctorAlert(input).type).toBe('warning')
    expect(section(input, 'High')).toBeUndefined()
    expect(section(input, 'Systemic patterns')).toBeDefined()
  })

  test('quotes compile commands for Windows paths with spaces and percents', () => {
    const commands = resolveAppDoctorCommands('C:/Users/50%/my app')
    const alert = buildDoctorAlert(reportInput({commands}))
    const compileCommand = formatAppDoctorCommand(commands.compile)

    expect(alert.options.nextSteps).toEqual([
      ['Investigate the review pack, then compile the trace with', {command: compileCommand}],
    ])
    expect(compileCommand).not.toContain('50%%')
    expect(formatAppDoctorCommand(commands.compile, 'cmd')).toContain('^%')
    expect(formatAppDoctorCommand(commands.compile, 'powershell')).toContain("'C:/Users/50%/my app'")
  })

  test('adds evidence, fix guidance, and scan details in verbose mode', () => {
    const serialized = JSON.stringify(buildDoctorAlert(reportInput({verbose: true})))

    expect(serialized).toContain('Fix: Use authenticate.admin(request).')
    expect(serialized).toContain('Capabilities')
    expect(serialized).toContain('has_backend')
    expect(serialized).toContain('Rules run')
    expect(section(reportInput({verbose: true}), 'Scan details')).toBeDefined()
  })

  test('uses a success banner when coverage is complete and no issues were found', () => {
    const alert = buildDoctorAlert(
      reportInput({
        scan: {
          ...scanWithIssues,
          issues: [],
          score: {total: 100, baseline: 100, grade: 'EXCELLENT'},
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
        score: null,
        detection: {...scanWithIssues.detection, framework: 'unknown', surface: 'unknown'},
        scan: {
          ...scanWithIssues.scan,
          coverage_complete: false,
          coverage_gaps: [{code: 'unsupported_framework', message: 'Backend could not be classified.'}],
        },
      },
    })
    const alert = buildDoctorAlert(input)
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
    const alert = buildDoctorAlert(input)

    expect(alert.type).toBe('warning')
    expect(alert.options.headline).toBe('1 security issue found.')
    expect(section(input, 'Medium')).toBeDefined()
  })

  test('summarizes compiled agent findings without scan next steps', () => {
    const input = reportInput({
      reviewPath: undefined,
      reviewCheckCount: undefined,
      findings: {accepted: 1, rejected: ['MISSING_TENANT_ISOLATION: file is outside the app']},
    })
    const alert = buildDoctorAlert(input)
    const serialized = JSON.stringify(alert)

    expect(alert.type).toBe('error')
    expect(alert.options.headline).toBe('App Doctor could not compile some agent findings.')
    expect(alert.options.nextSteps).toBeUndefined()
    expect(serialized).toContain('Merged 1 agent finding(s) into the trace.')
    expect(serialized).toContain('Rejected: MISSING_TENANT_ISOLATION: file is outside the app')
    expect(section(input, 'Agent findings')).toBeDefined()
  })

  test('does not describe a rejected compile as merged zero findings', () => {
    const input = reportInput({
      reviewPath: undefined,
      reviewCheckCount: undefined,
      findings: {
        accepted: 0,
        rejected: ['MISSING_TENANT_ISOLATION: finding file was not part of the scanned inputs: tests/app.test.ts'],
        warnings: ['MISSING_TENANT_ISOLATION: ignored inspected file outside the scanned inputs: vitest.config.ts'],
      },
    })
    const serialized = JSON.stringify(buildDoctorAlert(input))

    expect(serialized).toContain('No agent findings were merged.')
    expect(serialized).toContain('ignored inspected file outside the scanned inputs: vitest.config.ts')
  })

  test('renders engine-redacted titles, paths, and verbose evidence unchanged', () => {
    const serialized = JSON.stringify(
      buildDoctorAlert(
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

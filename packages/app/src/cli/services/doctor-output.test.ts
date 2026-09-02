import {buildDoctorAlert, formatDoctorJson} from './doctor-output.js'
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
            {filePath: 'app/routes/action.ts:42'},
          ],
          [
            {bold: 'Configured API version is no longer supported'},
            {subdued: 'EOL_API_VERSION'},
            {filePath: 'shopify.app.toml'},
          ],
        ],
      },
    })
    expect(alert.options.nextSteps).toEqual([
      [
        'Investigate the review pack, then compile the trace with',
        {command: 'shopify app doctor --findings .shopify/app-doctor/findings.json'},
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

  test('redacts secrets from titles, paths, and verbose evidence', () => {
    const secret = `shpat_${'a'.repeat(24)}`
    const serialized = JSON.stringify(
      buildDoctorAlert(
        reportInput({
          verbose: true,
          scan: {
            ...scanWithIssues,
            app: {name: `app ${secret}`, type: 'public'},
            issues: [
              {
                ...scanWithIssues.issues[0]!,
                title: `title ${secret}`,
                message: `message ${secret}`,
                snippet: `snippet ${secret}`,
                fix: {automated: false, description: `fix ${secret}`, guide: `https://example.com/${secret}`},
              },
            ],
          },
        }),
      ),
    )

    expect(serialized).not.toContain(secret)
    expect(serialized).toContain('[REDACTED:')
  })
})

describe('formatDoctorJson', () => {
  test('keeps existing JSON engine fields while applying authoritative version metadata', () => {
    expect(JSON.parse(formatDoctorJson({engine: {commit: 'abc123'}, findings: []}, engine)).engine).toEqual({
      ...engine,
      commit: 'abc123',
    })
  })
})

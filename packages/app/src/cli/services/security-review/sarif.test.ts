import {appSecurityReviewSarif, narrowedSarifCategory} from './sarif.js'
import {appSecurityReviewJsonOutputSchema, type AppSecurityReviewResult} from './types.js'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {readFile} from '@shopify/cli-kit/node/fs'
import {jsonSchemaValidate} from '@shopify/cli-kit/node/json-schema'
import {joinPath, moduleDirectory} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'

/**
 * The SARIF 2.1.0 schema from https://json.schemastore.org/sarif-2.1.0.json, the draft-07 copy of the OASIS schema
 * that GitHub's SARIF documentation links to. CLI Kit's validator doesn't know the `format` keywords, so they're
 * dropped: the URIs are checked by the expected log instead.
 */
async function sarifSchema(): Promise<object> {
  const schema = await readFile(joinPath(moduleDirectory(import.meta.url), 'fixtures/sarif-schema-2.1.0.json'))
  return JSON.parse(schema, (key, value) => (key === 'format' && typeof value === 'string' ? undefined : value))
}

const onWindows = process.platform === 'win32'
const appDirectory = onWindows ? 'C:\\apps\\my-app' : '/apps/my-app'
const resultsDirectory = onWindows
  ? 'C:\\apps\\my-app\\.shopify\\app-security\\shopify.app'
  : '/apps/my-app/.shopify/app-security/shopify.app'
const ordersPath = onWindows ? 'C:\\apps\\my-app\\app\\routes\\orders.tsx' : '/apps/my-app/app/routes/orders.tsx'
const settingsPath = onWindows ? 'C:\\apps\\my-app\\app\\routes\\settings.tsx' : '/apps/my-app/app/routes/settings.tsx'
const ordersUri = onWindows
  ? 'file:///C:/apps/my-app/app/routes/orders.tsx'
  : 'file:///apps/my-app/app/routes/orders.tsx'
const settingsUri = onWindows
  ? 'file:///C:/apps/my-app/app/routes/settings.tsx'
  : 'file:///apps/my-app/app/routes/settings.tsx'
const suppressionsFilePath = onWindows
  ? 'C:\\apps\\my-app\\shopify.app-security.json'
  : '/apps/my-app/shopify.app-security.json'
const bundlePath = onWindows ? 'C:\\apps\\my-app\\public\\bundle.js' : '/apps/my-app/public/bundle.js'
const bundleUri = onWindows ? 'file:///C:/apps/my-app/public/bundle.js' : 'file:///apps/my-app/public/bundle.js'
const scope = {includeDirs: [], excludes: [], noGitIgnore: false}
const sourceResult = {version: 2, status: 'executed', reason: null, analysisMode: null, generatedAt: null} as const

const credentialCheck = {
  id: 'CREDENTIAL_LOG_LEAKAGE',
  title: 'Credential reaches a log sink',
  severity: 'high',
  description: 'Detects direct credential flows to console and logger sinks.',
  guide: 'https://shopify.dev/docs/apps/build/authentication-authorization',
  docsUrl: 'https://shopify.dev/docs/apps/build/security/app-security-checks/credential-log-leakage',
  precedence: 'prefer-agent',
  appliedPrecedence: 'prefer-agent',
  status: 'executed',
  bySource: {deterministic: {...sourceResult, analysisMode: 'ast'}, agent: sourceResult},
  findings: [
    {
      source: 'deterministic',
      number: 1,
      disposition: 'superseded',
      location: {filePath: ordersPath, line: 12, column: 5},
      message: 'accessToken flows into console.log.',
      snippet: 'console.log(session.accessToken)',
      evidence: [],
      fix: {description: 'Remove credentials from logs.', guide: null, automated: false},
      suppression: null,
    },
    {
      source: 'agent',
      number: 2,
      disposition: 'active',
      location: {filePath: ordersPath, line: 12, column: 5},
      message: 'The session access token is written to the server log.',
      snippet: 'console.log(session.accessToken)',
      evidence: [
        {location: {filePath: ordersPath, line: 10, column: null}, quote: 'const session = await authenticate()'},
        {location: {filePath: ordersPath, line: null, column: null}, quote: null},
      ],
      confidence: 'high',
      reasoning: 'The session holds a live credential.',
      suppression: null,
    },
  ],
} satisfies AppSecurityReviewResult['checks'][number]

const tenantCheck = {
  id: 'MISSING_TENANT_ISOLATION',
  title: 'Database query may not be scoped by shop',
  severity: 'medium',
  description: "Detects database queries that don't reference the shop.",
  guide: null,
  docsUrl: null,
  precedence: 'union',
  appliedPrecedence: 'union',
  status: 'executed',
  bySource: {deterministic: null, agent: sourceResult},
  findings: [
    {
      source: 'agent',
      number: 3,
      disposition: 'active',
      location: {filePath: settingsPath, line: null, column: null},
      message: 'Settings are read by ID without checking the owning shop.',
      snippet: 'db.settings.findUnique({where: {id}})',
      evidence: [],
      confidence: null,
      reasoning: null,
      suppression: null,
    },
    {
      source: 'agent',
      number: 4,
      disposition: 'suppressed',
      location: {filePath: settingsPath, line: 20, column: null},
      message: 'Settings are deleted by ID without checking the owning shop.',
      snippet: 'db.settings.delete({where: {id}})',
      evidence: [],
      confidence: null,
      reasoning: null,
      suppression: {justification: 'An allowlist middleware restricts the route to the app owner.', origin: 'agent'},
    },
  ],
} satisfies AppSecurityReviewResult['checks'][number]

const passedCheck = {
  ...tenantCheck,
  id: 'WEBHOOK_HMAC',
  title: 'Webhook HMAC is not verified',
  severity: 'low',
  description: 'Detects webhook routes that skip HMAC verification.',
  findings: [],
} satisfies AppSecurityReviewResult['checks'][number]

const unresolvedCheck = {
  ...passedCheck,
  id: 'OPEN_REDIRECT',
  title: 'Redirect target comes from the request',
  severity: 'medium',
  description: 'Detects redirects to a URL taken from the request.',
  status: 'unresolved',
  bySource: {
    deterministic: {
      ...sourceResult,
      status: 'unresolved',
      reason: {code: 'agent_investigation_required', message: 'An agent needs to trace the redirect target.'},
    },
    agent: null,
  },
} satisfies AppSecurityReviewResult['checks'][number]

const notApplicableCheck = {
  ...passedCheck,
  id: 'THEME_SCRIPT_INJECTION',
  title: 'Theme app extension renders unescaped input',
  description: 'Detects unescaped input in theme app extension blocks.',
  status: 'not-applicable',
  bySource: {
    deterministic: {
      ...sourceResult,
      status: 'not-applicable',
      reason: {code: 'capability_absent', message: 'The app has no theme app extension.'},
    },
    agent: null,
  },
} satisfies AppSecurityReviewResult['checks'][number]

const resultsFiles = {
  deterministic: {
    path: `${resultsDirectory}${onWindows ? '\\' : '/'}deterministic-findings.json`,
    generatedAt: null,
    engine: {name: 'shopify-app-security', version: '1.0.0', ruleset: '2026-11'},
    scope,
  },
  agent: {
    path: `${resultsDirectory}${onWindows ? '\\' : '/'}agent-findings.json`,
    generatedAt: null,
    engine: {name: 'agent', version: '1'},
    scope,
  },
}

const result = appSecurityReviewJsonOutputSchema.validate({
  status: 'success',
  valid: true,
  app: {directory: appDirectory, configurationPath: null, clientId: 'client-id'},
  resultsDirectory,
  resultsFiles,
  detection: null,
  coverage: null,
  scopeDiffers: false,
  checks: [credentialCheck, tenantCheck, passedCheck],
  resultsDigest: '0123456789ab',
  blocking: {level: 'none', blockedCheckCount: 0},
  failOnUnresolved: false,
  missingCheckIds: [],
  suppressions: {
    filePath: suppressionsFilePath,
    entryCount: 0,
    suppressedFindingCount: 0,
    staleEntryCount: 0,
    ambiguousEntryCount: 0,
    entries: [],
  },
  savedSuppressions: null,
})

/**
 * A scan with an unresolved and a not applicable check, a check without results, a skipped file, and the unresolved
 * check's own gaps.
 */
const incomplete = appSecurityReviewJsonOutputSchema.validate({
  ...result,
  missingCheckIds: ['SQL_INJECTION'],
  coverage: {
    filesScanned: 12,
    filesSkipped: [{path: bundlePath, reason: 'too-large', sizeBytes: 3000000, detail: null}],
    gaps: [
      {code: 'skipped-file', message: 'public/bundle.js was too large to scan.', checkId: null, filePath: bundlePath},
      {
        code: 'unresolved-check',
        message: 'OPEN_REDIRECT needs an agent investigation.',
        checkId: 'OPEN_REDIRECT',
        filePath: null,
      },
      // The unresolved check's notification already gives this reason.
      {
        code: 'unsupported-framework',
        message: 'The framework is not supported.',
        checkId: 'OPEN_REDIRECT',
        filePath: null,
      },
    ],
    scanDirectories: [],
  },
  checks: [credentialCheck, unresolvedCheck, notApplicableCheck],
})

/** Recorded checks that all ran, and two checks that neither results file has. */
const withoutResults = appSecurityReviewJsonOutputSchema.validate({
  ...result,
  missingCheckIds: ['SQL_INJECTION', 'SSRF_REQUEST_FORGERY'],
})

/** Without a results file, every check has no result. */
const noResultsFile = appSecurityReviewJsonOutputSchema.validate({
  ...result,
  resultsFiles: {deterministic: null, agent: null},
  checks: [],
  missingCheckIds: ['SQL_INJECTION', 'SSRF_REQUEST_FORGERY'],
  resultsDigest: null,
})

function missingCheckNotification(checkId: string) {
  return {
    level: 'warning',
    message: {text: `${checkId} has no result: neither results file has this check.`},
    descriptor: {id: 'no-result'},
  }
}

describe('appSecurityReviewSarif', () => {
  test.each([
    ['checks with findings', result, []],
    ['unresolved checks and coverage gaps', incomplete, []],
    ['a run narrowed by --check-id', incomplete, ['OPEN_REDIRECT', 'CREDENTIAL_LOG_LEAKAGE']],
    ['checks without results', withoutResults, []],
    ['no results file', noResultsFile, []],
  ])('writes a valid SARIF 2.1.0 log for %s', async (_description, value, checkIds) => {
    const validation = jsonSchemaValidate(
      appSecurityReviewSarif(value, {checkIds}),
      await sarifSchema(),
      'fail',
      'sarif-2.1.0',
    )

    expect(validation.errors).toBeUndefined()
    expect(validation.state).toBe('ok')
  })

  test('leaves suppressed findings out, since GitHub code scanning would open alerts for them', () => {
    const results = appSecurityReviewSarif(result, {checkIds: []}).runs[0]!.results

    expect(results.map((sarifResult) => sarifResult.message.text)).not.toContain(
      'Settings are deleted by ID without checking the owning shop.',
    )
    expect(results.some((sarifResult) => 'suppressions' in sarifResult)).toBe(false)
  })

  test('maps checks to rules and active findings to results, leaving superseded and suppressed findings out', () => {
    expect(appSecurityReviewSarif(result, {checkIds: []})).toStrictEqual({
      $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
      version: '2.1.0',
      runs: [
        {
          tool: {
            driver: {
              name: 'Shopify app security check',
              semanticVersion: CLI_KIT_VERSION,
              informationUri: 'https://shopify.dev/docs/api/shopify-cli',
              rules: [
                {
                  id: 'CREDENTIAL_LOG_LEAKAGE',
                  shortDescription: {text: 'Credential reaches a log sink'},
                  fullDescription: {text: 'Detects direct credential flows to console and logger sinks.'},
                  help: {
                    text: 'Detects direct credential flows to console and logger sinks.\n\nGuide: https://shopify.dev/docs/apps/build/authentication-authorization',
                  },
                  helpUri: 'https://shopify.dev/docs/apps/build/security/app-security-checks/credential-log-leakage',
                  defaultConfiguration: {level: 'error'},
                  properties: {tags: ['security'], 'security-severity': '8.0'},
                },
                {
                  id: 'MISSING_TENANT_ISOLATION',
                  shortDescription: {text: 'Database query may not be scoped by shop'},
                  fullDescription: {text: "Detects database queries that don't reference the shop."},
                  help: {text: "Detects database queries that don't reference the shop."},
                  defaultConfiguration: {level: 'warning'},
                  properties: {tags: ['security'], 'security-severity': '5.0'},
                },
                {
                  id: 'WEBHOOK_HMAC',
                  shortDescription: {text: 'Webhook HMAC is not verified'},
                  fullDescription: {text: 'Detects webhook routes that skip HMAC verification.'},
                  help: {text: 'Detects webhook routes that skip HMAC verification.'},
                  defaultConfiguration: {level: 'note'},
                  properties: {tags: ['security'], 'security-severity': '2.0'},
                },
              ],
            },
          },
          invocations: [{executionSuccessful: true, toolExecutionNotifications: []}],
          columnKind: 'utf16CodeUnits',
          results: [
            {
              ruleId: 'CREDENTIAL_LOG_LEAKAGE',
              ruleIndex: 0,
              level: 'error',
              message: {text: 'The session access token is written to the server log.'},
              locations: [
                {
                  physicalLocation: {
                    artifactLocation: {uri: ordersUri},
                    region: {startLine: 12, startColumn: 5, snippet: {text: 'console.log(session.accessToken)'}},
                  },
                },
              ],
              relatedLocations: [
                {
                  id: 0,
                  physicalLocation: {artifactLocation: {uri: ordersUri}, region: {startLine: 10}},
                  message: {text: 'const session = await authenticate()'},
                },
                {id: 1, physicalLocation: {artifactLocation: {uri: ordersUri}}},
              ],
              properties: {source: 'agent', confidence: 'high'},
            },
            {
              ruleId: 'MISSING_TENANT_ISOLATION',
              ruleIndex: 1,
              level: 'warning',
              message: {text: 'Settings are read by ID without checking the owning shop.'},
              locations: [{physicalLocation: {artifactLocation: {uri: settingsUri}}}],
              properties: {source: 'agent'},
            },
          ],
        },
      ],
    })
  })

  test('lists unresolved, not applicable and missing checks and coverage gaps, and marks the execution unsuccessful', () => {
    const [run] = appSecurityReviewSarif(incomplete, {checkIds: []}).runs

    expect(run!.invocations).toStrictEqual([
      {
        executionSuccessful: false,
        toolExecutionNotifications: [
          {
            level: 'warning',
            message: {
              text: 'OPEN_REDIRECT is unresolved: An agent needs to trace the redirect target. (agent_investigation_required)',
            },
            descriptor: {id: 'unresolved'},
            associatedRule: {id: 'OPEN_REDIRECT', index: 1},
          },
          {
            level: 'note',
            message: {
              text: 'THEME_SCRIPT_INJECTION is not applicable: The app has no theme app extension. (capability_absent)',
            },
            descriptor: {id: 'not-applicable'},
            associatedRule: {id: 'THEME_SCRIPT_INJECTION', index: 2},
          },
          missingCheckNotification('SQL_INJECTION'),
          {
            level: 'warning',
            message: {text: 'public/bundle.js was too large to scan.'},
            descriptor: {id: 'skipped-file'},
            locations: [{physicalLocation: {artifactLocation: {uri: bundleUri}}}],
          },
        ],
      },
    ])
    expect(run).not.toHaveProperty('automationDetails')
  })

  test('lists the checks without results without a rule, and marks the execution unsuccessful', () => {
    const [run] = appSecurityReviewSarif(withoutResults, {checkIds: []}).runs

    expect(run!.tool.driver.rules.map((rule) => rule.id)).toStrictEqual([
      'CREDENTIAL_LOG_LEAKAGE',
      'MISSING_TENANT_ISOLATION',
      'WEBHOOK_HMAC',
    ])
    expect(run!.invocations).toStrictEqual([
      {
        executionSuccessful: false,
        toolExecutionNotifications: [
          missingCheckNotification('SQL_INJECTION'),
          missingCheckNotification('SSRF_REQUEST_FORGERY'),
        ],
      },
    ])
  })

  test('marks a run narrowed by --check-id to a check without results unsuccessful', () => {
    const narrowed = appSecurityReviewJsonOutputSchema.validate({
      ...withoutResults,
      checks: [],
      missingCheckIds: ['SQL_INJECTION'],
    })

    const [run] = appSecurityReviewSarif(narrowed, {checkIds: ['SQL_INJECTION']}).runs

    expect(run!.tool.driver.rules).toStrictEqual([])
    expect(run!.results).toStrictEqual([])
    expect(run!.invocations).toStrictEqual([
      {executionSuccessful: false, toolExecutionNotifications: [missingCheckNotification('SQL_INJECTION')]},
    ])
  })

  test('marks a log without a results file unsuccessful, with one notification instead of one for each check', () => {
    expect(appSecurityReviewSarif(noResultsFile, {checkIds: []}).runs[0]!.invocations).toStrictEqual([
      {
        executionSuccessful: false,
        toolExecutionNotifications: [
          {
            level: 'error',
            message: {text: 'No results file to review: run shopify app security check first.'},
            descriptor: {id: 'no-results-file'},
          },
        ],
      },
    ])
  })

  test('gives a run narrowed by --check-id a category of its own, from the sorted check IDs', () => {
    const narrowed = appSecurityReviewSarif(
      {...incomplete, checks: [credentialCheck, unresolvedCheck]},
      {checkIds: ['OPEN_REDIRECT', 'CREDENTIAL_LOG_LEAKAGE']},
    )

    expect(narrowed.runs[0]!.automationDetails).toStrictEqual({
      id: 'shopify-app-security/check-id/CREDENTIAL_LOG_LEAKAGE,OPEN_REDIRECT/client-id/client-id/',
    })
    expect(narrowedSarifCategory(['OPEN_REDIRECT', 'CREDENTIAL_LOG_LEAKAGE', 'OPEN_REDIRECT'], null)).toBe(
      'shopify-app-security/check-id/CREDENTIAL_LOG_LEAKAGE,OPEN_REDIRECT/',
    )
  })
})

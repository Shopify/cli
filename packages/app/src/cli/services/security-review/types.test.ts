import {appSecurityReviewJsonOutputSchema} from './types.js'
import {describe, expect, test} from 'vitest'

const onWindows = process.platform === 'win32'
const appDirectory = onWindows ? 'C:\\apps\\my-app' : '/apps/my-app'
const resultsDirectory = onWindows
  ? 'C:\\apps\\my-app\\.shopify\\app-security\\shopify.app'
  : '/apps/my-app/.shopify/app-security/shopify.app'
const ordersPath = onWindows ? 'C:\\apps\\my-app\\app\\routes\\orders.tsx' : '/apps/my-app/app/routes/orders.tsx'
const scope = {includeDirs: [], excludes: [], noGitIgnore: false}

const location = {filePath: ordersPath, line: 12, column: null}
const deterministicFinding = {
  source: 'deterministic',
  disposition: 'superseded',
  location,
  message: 'accessToken flows into console.log.',
  snippet: null,
  evidence: [{location, quote: 'console.log(session.accessToken)'}],
  fix: {description: 'Remove credentials from logs.', guide: null, automated: false},
}
const agentFinding = {
  source: 'agent',
  disposition: 'active',
  location,
  message: 'The session access token is written to the server log.',
  snippet: null,
  evidence: [],
  confidence: 'high',
  reasoning: null,
  suppression: null,
}
const sourceResult = {
  version: 2,
  status: 'executed',
  reason: null,
  analysisMode: 'ast',
  generatedAt: '2026-09-01T10:00:00Z',
}
const check = {
  id: 'CREDENTIAL_LOG_LEAKAGE',
  title: 'Credential reaches a log sink',
  severity: 'high',
  description: 'Detects direct credential flows to console and logger sinks.',
  guide: null,
  docsUrl: 'https://shopify.dev/docs/apps/build/security/app-security-checks/credential-log-leakage',
  precedence: 'prefer-agent',
  appliedPrecedence: 'prefer-agent',
  status: 'executed',
  bySource: {deterministic: sourceResult, agent: {...sourceResult, analysisMode: null}},
  findings: [deterministicFinding, agentFinding],
}
const result = {
  status: 'success',
  valid: false,
  app: {
    directory: appDirectory,
    configurationPath: onWindows ? 'C:\\apps\\my-app\\shopify.app.toml' : '/apps/my-app/shopify.app.toml',
    clientId: 'toml-client-id',
  },
  resultsDirectory,
  resultsFiles: {
    deterministic: {
      path: onWindows
        ? `${resultsDirectory}\\deterministic-findings.json`
        : `${resultsDirectory}/deterministic-findings.json`,
      generatedAt: '2026-09-01T10:00:00Z',
      engine: {name: 'shopify-app-security', version: '4.9.0', ruleset: 'app-security-rules@4.9.0'},
      scope,
    },
    agent: {
      path: onWindows ? `${resultsDirectory}\\agent-findings.json` : `${resultsDirectory}/agent-findings.json`,
      generatedAt: null,
      engine: {name: 'shopify-app-security', version: '4.9.0'},
      scope,
    },
  },
  detection: {
    framework: 'react-router',
    surface: 'react-router',
    languages: [{name: 'typescript', support: 'supported', files: [{path: ordersPath}]}],
  },
  coverage: {
    filesScanned: 12,
    filesSkipped: [],
    gaps: [{code: 'unresolved-check', message: 'A gap.', checkId: 'CREDENTIAL_LOG_LEAKAGE', filePath: null}],
    scanDirectories: [{directory: appDirectory, origin: 'app-directory'}],
  },
  scopeDiffers: false,
  checks: [check],
  blocking: {level: 'high', blockedCheckCount: 1},
}

describe('appSecurityReviewJsonOutputSchema', () => {
  test.each([
    ['both results files', result],
    [
      'no results file',
      {
        ...result,
        valid: true,
        resultsFiles: {deterministic: null, agent: null},
        detection: null,
        coverage: null,
        checks: [],
        blocking: {level: 'none', blockedCheckCount: 0},
      },
    ],
    [
      'a whole-file location',
      {...result, checks: [{...check, findings: [{...agentFinding, location: {...location, line: null}}]}]},
    ],
  ])('accepts a result with %s', (_description, value) => {
    expect(appSecurityReviewJsonOutputSchema.validate(value)).toStrictEqual(value)
  })

  test.each([
    ['an extra field', {...result, checkCount: 1}],
    ['an extra results file field', {...result, resultsFiles: {...result.resultsFiles, instructions: null}}],
    ['an extra check field', {...result, checks: [{...check, docs_url: check.docsUrl}]}],
    ['an extra source result field', {...result, checks: [{...check, bySource: {...check.bySource, other: null}}]}],
    [
      'an agent field on a deterministic finding',
      {...result, checks: [{...check, findings: [{...deterministicFinding, confidence: 'high'}]}]},
    ],
    ['a fix on an agent finding', {...result, checks: [{...check, findings: [{...agentFinding, fix: null}]}]}],
    [
      'an extra location field',
      {...result, checks: [{...check, findings: [{...agentFinding, location: {...location, file: 'x'}}]}]},
    ],
    [
      'an extra scope field',
      {
        ...result,
        resultsFiles: {
          ...result.resultsFiles,
          deterministic: {...result.resultsFiles.deterministic, scope: {...scope, no_git_ignore: false}},
        },
      },
    ],
    ['an extra blocking field', {...result, blocking: {...result.blocking, blockedChecks: 1}}],
    ['a missing field', {...result, coverage: undefined}],
    [
      'a relative finding path',
      {
        ...result,
        checks: [{...check, findings: [{...agentFinding, location: {...location, filePath: 'app/routes/orders.tsx'}}]}],
      },
    ],
    [
      'a relative scan directory',
      {...result, coverage: {...result.coverage, scanDirectories: [{directory: '.', origin: 'app-directory'}]}},
    ],
    ['a zero line', {...result, checks: [{...check, findings: [{...agentFinding, location: {...location, line: 0}}]}]}],
    [
      'a fractional column',
      {...result, checks: [{...check, findings: [{...agentFinding, location: {...location, column: 1.5}}]}]},
    ],
    ['a docs URL that is not a URL', {...result, checks: [{...check, docsUrl: 'credential-log-leakage'}]}],
    ['an empty check guide', {...result, checks: [{...check, guide: ''}]}],
    ['an empty snippet', {...result, checks: [{...check, findings: [{...deterministicFinding, snippet: ''}]}]}],
    [
      'an empty evidence quote',
      {...result, checks: [{...check, findings: [{...deterministicFinding, evidence: [{location, quote: ''}]}]}]},
    ],
    [
      'an empty fix guide',
      {
        ...result,
        checks: [{...check, findings: [{...deterministicFinding, fix: {...deterministicFinding.fix, guide: ''}}]}],
      },
    ],
    ['an empty agent reasoning', {...result, checks: [{...check, findings: [{...agentFinding, reasoning: ''}]}]}],
    [
      'an empty skipped file detail',
      {
        ...result,
        coverage: {
          ...result.coverage,
          filesSkipped: [{path: ordersPath, reason: 'unreadable', sizeBytes: null, detail: ''}],
        },
      },
    ],
    [
      'a fractional-second time',
      {
        ...result,
        checks: [
          {
            ...check,
            bySource: {...check.bySource, deterministic: {...sourceResult, generatedAt: '2026-09-01T10:00:00.000Z'}},
          },
        ],
      },
    ],
    ['a stored status', {...result, checks: [{...check, status: 'not_applicable'}]}],
    [
      'a stored analysis mode',
      {
        ...result,
        checks: [
          {
            ...check,
            bySource: {...check.bySource, deterministic: {...sourceResult, analysisMode: 'structured_config'}},
          },
        ],
      },
    ],
    ['a stored framework', {...result, detection: {...result.detection, framework: 'react_router'}}],
    [
      'a stored scan directory origin',
      {
        ...result,
        coverage: {...result.coverage, scanDirectories: [{directory: appDirectory, origin: 'app_directory'}]},
      },
    ],
    ['an unknown source', {...result, checks: [{...check, findings: [{...agentFinding, source: 'manual'}]}]}],
    ['an unknown blocking level', {...result, blocking: {level: 'critical', blockedCheckCount: 1}}],
    ['a negative blocked check count', {...result, blocking: {level: 'high', blockedCheckCount: -1}}],
    ['another status', {...result, status: 'cancelled'}],
  ])('rejects %s', (_description, value) => {
    expect(() => appSecurityReviewJsonOutputSchema.validate(value)).toThrow()
  })
})

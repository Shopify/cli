import {appSecurityReviewJsonOutputSchema} from './types.js'
import {jsonSchemaValidate, normaliseJsonSchema} from '@shopify/cli-kit/node/json-schema'
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
  number: 1,
  disposition: 'superseded',
  location,
  message: 'accessToken flows into console.log.',
  snippet: null,
  evidence: [{location, quote: 'console.log(session.accessToken)'}],
  fix: {description: 'Remove credentials from logs.', guide: null, automated: false},
  suppression: null,
}
const fileSuppression = {
  justification: 'The token is a fake one in a test fixture.',
  origin: 'file',
  entryIndex: 0,
  kind: 'false-positive',
}
const agentSuppression = {justification: 'An allowlist middleware restricts the route.', origin: 'agent'}
const agentFinding = {
  source: 'agent',
  number: 2,
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
  resultsDigest: '3f2a9c0d41be',
  blocking: {level: 'high', blockedCheckCount: 1},
  suppressions: {
    filePath: onWindows ? 'C:\\apps\\my-app\\shopify.app-security.json' : '/apps/my-app/shopify.app-security.json',
    entryCount: 2,
    suppressedFindingCount: 1,
    staleEntryCount: 1,
    ambiguousEntryCount: 0,
    entries: [
      {
        index: 0,
        source: 'deterministic',
        check: 'CREDENTIAL_LOG_LEAKAGE',
        kind: 'false-positive',
        path: ordersPath,
        status: 'matched',
        matchedFindingCount: 1,
        likelyPath: null,
        candidateFindingCount: null,
        likelyFinding: null,
      },
      {
        index: 1,
        source: 'agent',
        check: 'CREDENTIAL_LOG_LEAKAGE',
        kind: 'accepted-risk',
        path: onWindows ? 'C:\\apps\\my-app\\app\\routes\\orders.old.tsx' : '/apps/my-app/app/routes/orders.old.tsx',
        status: 'stale',
        matchedFindingCount: 0,
        likelyPath: ordersPath,
        candidateFindingCount: null,
        likelyFinding: null,
      },
    ],
  },
  savedSuppressions: null,
}

const savedEntry = {
  index: 0,
  change: 'added',
  source: 'agent',
  check: 'CREDENTIAL_LOG_LEAKAGE',
  kind: 'false-positive',
  path: ordersPath,
  code: 'console.log(session.accessToken)',
  reason: 'The logger redacts tokens.',
  configurations: ['shopify.app.toml'],
  previous: null,
  findingNumber: 2,
}
const savedSuppressions = {
  filePath: result.suppressions.filePath,
  entries: [savedEntry],
  companionFindingNumbers: [1],
}

/** The suppressions of `result` with a stale entry whose code likely became finding 2 after an edit. */
const withLikelyFinding = {
  ...result.suppressions,
  entries: [
    result.suppressions.entries[0],
    {
      ...result.suppressions.entries[1],
      likelyPath: null,
      likelyFinding: {filePath: ordersPath, line: 12, findingNumber: 2},
    },
  ],
}
const reattachedEntry = {
  ...savedEntry,
  change: 'code-replaced',
  previous: {code: 'console.log(session.idToken)', kind: 'accepted-risk', reason: 'Placeholder tokens.'},
}

/** The result with one check that holds these findings. */
const withFindings = (...findings: unknown[]) => ({...result, checks: [{...check, findings}]})

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
        resultsDigest: null,
        blocking: {level: 'none', blockedCheckCount: 0},
      },
    ],
    [
      'a whole-file location',
      {...result, checks: [{...check, findings: [{...agentFinding, location: {...location, line: null}}]}]},
    ],
    [
      'a deterministic finding that an entry suppresses',
      withFindings({...deterministicFinding, disposition: 'suppressed', suppression: fileSuppression}),
    ],
    [
      'an agent finding that an entry suppresses',
      withFindings({
        ...agentFinding,
        disposition: 'suppressed',
        suppression: {...fileSuppression, kind: 'accepted-risk'},
      }),
    ],
    [
      'an agent finding that the agent suppresses',
      withFindings({...agentFinding, disposition: 'suppressed', suppression: agentSuppression}),
    ],
    [
      'no suppressions file',
      {
        ...result,
        suppressions: {
          ...result.suppressions,
          entryCount: 0,
          suppressedFindingCount: 0,
          staleEntryCount: 0,
          ambiguousEntryCount: 0,
          entries: [],
        },
      },
    ],
    ['the entries that --suppress saved, and a companion it left out', {...result, savedSuppressions}],
    [
      'a saved entry without code that got a configuration, and no companion',
      {
        ...result,
        savedSuppressions: {
          ...savedSuppressions,
          entries: [{...savedEntry, change: 'configuration-added', code: null, configurations: ['a', 'b']}],
          companionFindingNumbers: [],
        },
      },
    ],
    ['a stale entry with its likely finding', {...result, suppressions: withLikelyFinding}],
    [
      'an entry that --suppress re-attached, with its previous code, kind and reason',
      {...result, savedSuppressions: {...savedSuppressions, entries: [reattachedEntry]}},
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
    ['a deterministic finding without a suppression', withFindings({...deterministicFinding, suppression: undefined})],
    [
      "today's agent suppression without an origin",
      withFindings({...agentFinding, suppression: {justification: agentSuppression.justification}}),
    ],
    [
      'an agent suppression with an entry index',
      withFindings({...agentFinding, suppression: {...agentSuppression, entryIndex: 0}}),
    ],
    [
      'a file suppression without a kind',
      withFindings({...agentFinding, suppression: {...fileSuppression, kind: undefined}}),
    ],
    [
      'a file suppression kind with an underscore',
      withFindings({...deterministicFinding, suppression: {...fileSuppression, kind: 'accepted_risk'}}),
    ],
    [
      'a file suppression with a negative entry index',
      withFindings({...deterministicFinding, suppression: {...fileSuppression, entryIndex: -1}}),
    ],
    [
      'another suppression origin',
      withFindings({...agentFinding, suppression: {...agentSuppression, origin: 'inline'}}),
    ],
    ['no suppressions', {...result, suppressions: undefined}],
    ['no ambiguous entry count', {...result, suppressions: {...result.suppressions, ambiguousEntryCount: undefined}}],
    [
      'an entry without its candidate finding count',
      {
        ...result,
        suppressions: {
          ...result.suppressions,
          entries: [{...result.suppressions.entries[0], candidateFindingCount: undefined}],
        },
      },
    ],
    ['a finding without a number', withFindings({...agentFinding, number: undefined})],
    ['a finding numbered 0', withFindings({...agentFinding, number: 0})],
    ['no results digest', {...result, resultsDigest: undefined}],
    ['an empty results digest', {...result, resultsDigest: ''}],
    ['no saved suppressions', {...result, savedSuppressions: undefined}],
    [
      'a saved entry without its finding number',
      {...result, savedSuppressions: {...savedSuppressions, entries: [{...savedEntry, findingNumber: undefined}]}},
    ],
    [
      'a saved entry with a kind with an underscore',
      {...result, savedSuppressions: {...savedSuppressions, entries: [{...savedEntry, kind: 'false_positive'}]}},
    ],
    [
      'a saved entry with a relative path',
      {...result, savedSuppressions: {...savedSuppressions, entries: [{...savedEntry, path: 'app/routes/x.tsx'}]}},
    ],
    ['an extra saved suppressions field', {...result, savedSuppressions: {...savedSuppressions, companions: []}}],
    [
      'an entry without its likely finding',
      {
        ...result,
        suppressions: {...withLikelyFinding, entries: [{...withLikelyFinding.entries[1], likelyFinding: undefined}]},
      },
    ],
    [
      'a likely finding with a relative path',
      {
        ...result,
        suppressions: {
          ...withLikelyFinding,
          entries: [
            {...withLikelyFinding.entries[1], likelyFinding: {filePath: 'app/a.ts', line: 1, findingNumber: 1}},
          ],
        },
      },
    ],
    [
      'a saved entry without its previous fields',
      {...result, savedSuppressions: {...savedSuppressions, entries: [{...savedEntry, previous: undefined}]}},
    ],
    [
      'an unknown saved change',
      {...result, savedSuppressions: {...savedSuppressions, entries: [{...reattachedEntry, change: 'code_replaced'}]}},
    ],
  ])('rejects %s', (_description, value) => {
    expect(() => appSecurityReviewJsonOutputSchema.validate(value)).toThrow()
  })

  // The whole schema has date-time formats, which the validator doesn't know, so the parts with the new fields are checked.
  test('the --json-schema definitions accept the suppression fields and reject an entry index or kind out of place', async () => {
    const {definitions} = await normaliseJsonSchema(JSON.stringify(appSecurityReviewJsonOutputSchema.jsonSchema))
    const validFindings = [
      {...deterministicFinding, disposition: 'suppressed', suppression: fileSuppression},
      deterministicFinding,
      {...agentFinding, disposition: 'suppressed', suppression: agentSuppression},
      {...agentFinding, disposition: 'suppressed', suppression: fileSuppression},
    ]

    for (const finding of validFindings) {
      expect(jsonSchemaValidate(finding, definitions.AppSecurityFinding, 'fail').state).toBe('ok')
    }
    expect(jsonSchemaValidate(result.suppressions, definitions.AppSecuritySuppressions, 'fail').state).toBe('ok')
    expect(jsonSchemaValidate(savedSuppressions, definitions.AppSecuritySavedSuppressions, 'fail').state).toBe('ok')
    expect(jsonSchemaValidate(withLikelyFinding, definitions.AppSecuritySuppressions, 'fail').state).toBe('ok')
    const reattached = {...savedSuppressions, entries: [reattachedEntry]}
    expect(jsonSchemaValidate(reattached, definitions.AppSecuritySavedSuppressions, 'fail').state).toBe('ok')
    expect(jsonSchemaValidate({...agentFinding, number: 0}, definitions.AppSecurityFinding, 'fail').state).toBe('error')
    const agentWithEntryIndex = {...agentFinding, suppression: {...agentSuppression, entryIndex: 0}}
    expect(jsonSchemaValidate(agentWithEntryIndex, definitions.AppSecurityFinding, 'fail').state).toBe('error')
    const underscoreKind = {...deterministicFinding, suppression: {...fileSuppression, kind: 'false_positive'}}
    expect(jsonSchemaValidate(underscoreKind, definitions.AppSecurityFinding, 'fail').state).toBe('error')
  })
})

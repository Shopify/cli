import {
  COMBINED_CHECK_MATCHES_REVIEW_JSON,
  SOURCES_MATCH_REVIEW_JSON,
  securityReviewJsonOutputSchema,
  toSecurityReviewJson,
} from './security-review-json.js'
import {reviewAppSecurityResults} from './security-review.js'
import {appSecurityArtifactPaths} from './app-security-artifacts.js'
import {appSecurityResultsFor} from './app-security-results.test-data.js'
import {
  agentFindingsDocument,
  deterministicFindingsDocument,
} from './app-security-engine/tests/fixtures/findings-documents.js'
import {readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import {fileURLToPath} from 'node:url'
import type {AppSecurityResults} from './app-security-results.js'

const fixtureDirectory = fileURLToPath(new URL('./app-security-json-fixtures', import.meta.url))
const appRoot = '/tmp/review-app'
const resultsKey = 'shopify.app'
const resultsDirectory = appSecurityArtifactPaths(appRoot, resultsKey).resultsDirectory

function results(sources: {deterministic: boolean; agent: boolean}): AppSecurityResults {
  return appSecurityResultsFor(appRoot, resultsKey, {
    deterministic: sources.deterministic ? deterministicFindingsDocument : null,
    agent: sources.agent ? agentFindingsDocument : null,
  })
}

describe('app security review JSON contract', () => {
  test('keeps the engine types and the public schema in sync', () => {
    // `tsc` is the real check: the constants only compile when the types match the schema.
    expect(COMBINED_CHECK_MATCHES_REVIEW_JSON).toBe(true)
    expect(SOURCES_MATCH_REVIEW_JSON).toBe(true)
  })

  test('encodes both sources without their checks, the combined checks, and a null filter', async () => {
    const result = reviewAppSecurityResults(results({deterministic: true, agent: true}), {
      resultsDirectory,
      checkIds: [],
      blocking: 'none',
    })

    const encoded = securityReviewJsonOutputSchema.encode(toSecurityReviewJson(result))

    const fixture = await readFile(joinPath(fixtureDirectory, 'review.json'))
    expect(JSON.parse(encoded)).toStrictEqual(JSON.parse(fixture))
  })

  test('encodes the --check-id filter and only the filtered checks', async () => {
    const result = reviewAppSecurityResults(results({deterministic: true, agent: false}), {
      resultsDirectory,
      checkIds: ['OPEN_REDIRECT', 'CREDENTIAL_LOG_LEAKAGE'],
      blocking: 'none',
    })

    const encoded = securityReviewJsonOutputSchema.encode(toSecurityReviewJson(result))

    const fixture = await readFile(joinPath(fixtureDirectory, 'review-filtered.json'))
    expect(JSON.parse(encoded)).toStrictEqual(JSON.parse(fixture))
  })

  test('encodes missing files as null sources with no checks', () => {
    const result = reviewAppSecurityResults(results({deterministic: false, agent: false}), {
      resultsDirectory,
      checkIds: [],
      blocking: 'none',
    })

    const encoded = securityReviewJsonOutputSchema.encode(toSecurityReviewJson(result))

    expect(JSON.parse(encoded)).toStrictEqual({
      filter: null,
      sources: {deterministic: null, agent: null},
      scope_differs: false,
      checks: [],
    })
  })

  test('reports that the agent findings were recorded for a different scope than the latest scan', () => {
    const agentScope = {include_dirs: ['../backend'], excludes: [], no_git_ignore: false}
    const result = reviewAppSecurityResults(
      appSecurityResultsFor(appRoot, resultsKey, {
        deterministic: deterministicFindingsDocument,
        agent: {...agentFindingsDocument, scope: agentScope},
      }),
      {resultsDirectory, checkIds: [], blocking: 'none'},
    )

    const json = JSON.parse(securityReviewJsonOutputSchema.encode(toSecurityReviewJson(result)))

    expect(json.scope_differs).toBe(true)
    expect(json.sources.agent.scope).toEqual(agentScope)
    expect(json.sources.deterministic.coverage.scope).toEqual(deterministicFindingsDocument.coverage.scope)
    expect(json.sources.deterministic.coverage.scan_directories).toEqual([{directory: '.', origin: 'app_directory'}])
  })

  test('echoes the requested IDs when no file is present', () => {
    const result = reviewAppSecurityResults(results({deterministic: false, agent: false}), {
      resultsDirectory,
      checkIds: ['UNKNOWN_CHECK'],
      blocking: 'none',
    })

    const encoded = securityReviewJsonOutputSchema.encode(toSecurityReviewJson(result))

    expect(JSON.parse(encoded)).toStrictEqual({
      filter: {check_ids: ['UNKNOWN_CHECK']},
      sources: {deterministic: null, agent: null},
      scope_differs: false,
      checks: [],
    })
  })

  test('rejects a finding whose disposition is unknown', () => {
    const result = reviewAppSecurityResults(results({deterministic: true, agent: true}), {
      resultsDirectory,
      checkIds: [],
      blocking: 'none',
    })
    const json = toSecurityReviewJson(result)
    const [check] = json.checks
    const [finding] = check!.findings
    ;(finding as {disposition: string}).disposition = 'ignored'

    expect(() => securityReviewJsonOutputSchema.encode(json)).toThrow()
  })
})

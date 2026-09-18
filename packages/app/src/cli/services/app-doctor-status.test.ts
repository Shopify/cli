import {getAppDoctorStatus, writeAppDoctorStatusResult} from './app-doctor-status.js'
import {resolveAppDoctorContext, type ResolveAppDoctorContextOptions} from './app-doctor-context.js'
import {
  buildAppDoctorMetadataInventory,
  editAppDoctorSuppressions,
  enumerateAppDoctorResults,
  interpretAppDoctorResults,
  readAppDoctorSuppressions,
  replaceAppDoctorResults,
} from './app-doctor-engine/index.js'
import {generateAppDoctorInstructions} from './app-doctor-instructions.js'
import {recordAppDoctorReview} from './app-doctor-record.js'
import {renderAppDoctorStatusReport} from './app-doctor-report.js'
import {appDoctorStatusJsonOutputSchema, type AppDoctorStatusResult} from './app-doctor-status-json.js'
import {
  inCanonicalTemporaryDirectory,
  linkedConfiguration,
  makeFixtureDirectory,
  writeFixtureFile,
} from './app-doctor-engine/tests/context-test-helpers.js'
import {resultPath, resultsDirectory, smallCheckCatalogue} from './app-doctor-engine/tests/store-fixtures.js'
import {AppLocalStorageSchema} from './local-storage.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {copyFile, mkdir, rmdir, writeFile} from '@shopify/cli-kit/node/fs'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {outputResult} from '@shopify/cli-kit/node/output'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'
import type {AppDoctorInstructionsResult} from './app-doctor-instructions-json.js'

vi.mock('./app-doctor-report.js')
vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/output')>()),
  outputResult: vi.fn(),
}))

const PRODUCED_AT = new Date('2026-09-16T12:00:00.000Z')

interface Fixture {
  readonly root: string
  readonly appRoot: string
  readonly configurationPath: string
  readonly instructions: AppDoctorInstructionsResult
}

/** Generating and recording share one small catalogue, so each publication writes a couple of files, not 33. */
function dependencies(root: string) {
  const appStorage = new LocalStorage<AppLocalStorageSchema>({cwd: joinPath(root, 'storage')})
  const resolveContext = (options: ResolveAppDoctorContextOptions) => resolveAppDoctorContext({...options, appStorage})
  const loadChecks = () => smallCheckCatalogue()
  return {
    generate: {resolveContext, invocationDirectory: () => root, quote: (value: string) => `<${value}>`, loadChecks},
    record: {resolveContext, now: () => PRODUCED_AT, replaceAppDoctorResults, loadChecks},
    status: {resolveContext},
    context: (directory: string) => resolveContext({directory, interactive: false}),
  }
}

/** A git repository containing one linked app, with instructions generated for the app root (or `reviewDirectories`). */
async function createFixture(
  root: string,
  name = 'repo',
  appDirectory = 'app',
  reviewDirectories?: string[],
): Promise<Fixture> {
  const repository = await makeFixtureDirectory(root, name)
  await makeFixtureDirectory(repository, '.git')
  const configurationPath = await writeFixtureFile(
    repository,
    `${appDirectory}/shopify.app.toml`,
    linkedConfiguration('id-1'),
  )
  await makeFixtureDirectory(repository, `${appDirectory}/web`)
  const appRoot = joinPath(repository, appDirectory)
  const instructions = await generateAppDoctorInstructions(
    {directory: appRoot, interactive: false, format: 'text', reviewDirectories},
    {...dependencies(root).generate, invocationDirectory: () => appRoot},
  )
  return {root, appRoot, configurationPath, instructions}
}

type FindingsChecks = {check_id: string; outcome: string; inspected_files: string[]; findings: unknown[]}[]

/** Every check `not_applicable` unless overridden. */
function findingsDocument(fixture: Fixture, overrides: Partial<Record<string, Partial<FindingsChecks[number]>>> = {}) {
  return {
    schema_version: 1,
    review: fixture.instructions.scopes[0]!.token,
    checks: fixture.instructions.checks.map((check) => ({
      check_id: check.id,
      outcome: 'not_applicable',
      inspected_files: [],
      findings: [],
      ...overrides[check.id],
    })),
  }
}

function withFinding(fixture: Fixture) {
  const firstCheck = fixture.instructions.checks[0]!.id
  return findingsDocument(fixture, {
    [firstCheck]: {
      outcome: 'findings',
      inspected_files: ['web/index.ts'],
      findings: [
        {
          title: 'Example finding',
          message: 'The handler trusts the shop parameter.',
          severity: 'high',
          location: {file: 'web/index.ts', line: 3},
          evidence: [{location: {file: 'web/index.ts', line: 3}, quote: 'req.query.shop'}],
          fix: {description: 'Use the session shop.'},
          agent_confidence: 'high',
          agent_reasoning: 'The value flows into the query unchecked.',
        },
      ],
    },
  })
}

async function record(fixture: Fixture, document: unknown, name = 'findings.json') {
  const findingsPath = await writeFixtureFile(fixture.root, `reviews/${name}`, JSON.stringify(document))
  return recordAppDoctorReview(
    {
      directory: fixture.appRoot,
      reviews: [fixture.instructions.scopes[0]!.token],
      findings: [findingsPath],
      interactive: false,
    },
    dependencies(fixture.root).record,
  )
}

async function status(fixture: Fixture, directory = fixture.appRoot) {
  return getAppDoctorStatus({directory, interactive: false}, dependencies(fixture.root).status)
}

async function expectAbort(promise: Promise<unknown>): Promise<AbortError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof AbortError) return error
    throw error
  }
  throw new Error('expected an AbortError')
}

describe('getAppDoctorStatus', () => {
  test('reports an empty store as a normal state with nothing recorded', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      const context = await dependencies(root).context(fixture.appRoot)

      const result = await status(fixture)

      expect(result).toEqual({
        schema_version: 1,
        basis: 'stored-results',
        configuration: {
          identity: context.configurationIdentity,
          path: fixture.configurationPath,
          name: 'shopify.app.toml',
          client_id: 'id-1',
        },
        app_root: fixture.appRoot,
        store: {directory: context.storeDirectory, state: 'missing'},
        // Only scopes with recorded results are listed; the app root has none yet.
        scopes: [],
        findings: [],
        coverage: {
          static_result_count: 0,
          complete: false,
          files_skipped: 0,
          unsupported_languages: [],
          gaps: [],
          owners: [],
        },
        score: {status: 'withheld', reason: 'no_static_results'},
        suppressions: {matched: 0, suppressed_findings: 0, unmatched: []},
        diagnostics: [],
      })
    })
  })

  test('reads recorded agent results back per scope and check without rescanning', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      await record(fixture, withFinding(fixture))
      const checkIds = fixture.instructions.checks.map((check) => check.id)

      const result = await status(fixture)

      expect(result.basis).toBe('stored-results')
      expect(result.store.state).toBe('present')
      expect(result.scopes).toHaveLength(1)
      const [scope] = result.scopes
      expect(scope!.scope_identity).toBe(fixture.instructions.scopes[0]!.scope_identity)
      expect(scope).not.toHaveProperty('current')
      expect(scope!.directory).toBe(fixture.appRoot)
      expect(scope!.directory_resolved).toBe(true)
      expect(scope!.checks.map((check) => check.check_id)).toEqual(checkIds)
      expect(scope!.checks[0]).toEqual({
        check_id: checkIds[0],
        static: {outcome: 'not_run'},
        agent: {
          outcome: 'findings',
          produced_at: PRODUCED_AT.toISOString(),
          check_version: fixture.instructions.checks[0]!.version,
          finding_count: 1,
          guidance: expect.any(String),
        },
      })
      expect(scope!.checks[1]!.agent).toMatchObject({
        outcome: 'not_applicable',
        produced_at: PRODUCED_AT.toISOString(),
        finding_count: 0,
        reason: {code: expect.any(String), message: expect.any(String)},
      })
      expect(result.findings).toHaveLength(1)
      expect(result.findings[0]).toMatchObject({
        scope_identity: scope!.scope_identity,
        code: checkIds[0],
        severity: 'high',
        title: 'Example finding',
        // Stored findings name files by their recorded evidence path (relative to the storage anchor) and,
        // for anchor-relative references, by where that file would be on this machine today.
        location: {file: 'anchor/0/app/web/index.ts', path: joinPath(fixture.appRoot, 'web/index.ts'), line: 3},
        sources: ['agent'],
        suppressed: false,
        fix: {automated: false, description: 'Use the session shop.'},
        scoring: {eligible: expect.any(Boolean), points: expect.any(Number)},
      })
      expect(result.findings[0]!.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
      expect(result.coverage.static_result_count).toBe(0)
      expect(result.score).toEqual({status: 'withheld', reason: 'no_static_results'})
      expect(result.suppressions).toEqual({matched: 0, suppressed_findings: 0, unmatched: []})
      expect(result.diagnostics).toEqual([])
    })
  })

  test('reports the same checks and findings as a direct interpretation of the same store', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      await record(fixture, withFinding(fixture))
      const context = await dependencies(root).context(fixture.appRoot)
      const read = await enumerateAppDoctorResults(context)
      const results = read.results.map((entry) => entry.result)
      const suppressionRead = await readAppDoctorSuppressions(context)
      const interpretation = interpretAppDoctorResults({
        configurationIdentity: context.configurationIdentity,
        results,
        inventory: buildAppDoctorMetadataInventory(context, results),
        suppressions: suppressionRead.status === 'ok' ? suppressionRead.document.suppressions : [],
      })

      const result = await status(fixture)

      const reportedCheckIds = new Set(result.scopes.flatMap((scope) => scope.checks.map((check) => check.check_id)))
      const interpretedCheckIds = new Set(
        interpretation.scopes.flatMap((scope) => scope.checks.map((check) => check.checkId)),
      )
      expect(reportedCheckIds).toEqual(interpretedCheckIds)
      expect(reportedCheckIds.size).toBeGreaterThan(0)
      expect(new Set(result.findings.map((finding) => finding.fingerprint))).toEqual(
        new Set(interpretation.findings.map((finding) => finding.fingerprint)),
      )
      expect(result.findings).toHaveLength(1)
    })
  })

  test('lists suppressions that match no stored finding instead of dropping them', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      await record(fixture, withFinding(fixture))
      const context = await dependencies(root).context(fixture.appRoot)
      const bogusFingerprint = `sha256:${'f'.repeat(64)}`
      const edit = await editAppDoctorSuppressions(context, [
        {
          operation: 'add',
          value: {
            id: 'sup-bogus',
            finding_fingerprint: bogusFingerprint,
            justification: 'Refers to a finding that no longer exists.',
            provenance: {source: 'human', created_at: PRODUCED_AT.toISOString()},
          },
        },
      ])
      expect(edit.status).toBe('created')

      const result = await status(fixture)

      expect(result.findings[0]!.suppressed).toBe(false)
      expect(result.suppressions).toEqual({
        matched: 0,
        suppressed_findings: 0,
        unmatched: [{id: 'sup-bogus', finding_fingerprint: bogusFingerprint}],
      })
    })
  })

  test('marks a suppressed finding and counts the matched suppression', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      await record(fixture, withFinding(fixture))
      const context = await dependencies(root).context(fixture.appRoot)
      const {fingerprint} = (await status(fixture)).findings[0]!
      const edit = await editAppDoctorSuppressions(context, [
        {
          operation: 'add',
          value: {
            id: 'sup-1',
            finding_fingerprint: fingerprint,
            justification: 'Reviewed and accepted.',
            provenance: {source: 'human', created_at: PRODUCED_AT.toISOString()},
          },
        },
      ])
      expect(edit.status).toBe('created')

      const result = await status(fixture)

      expect(result.findings).toHaveLength(1)
      expect(result.findings[0]).toMatchObject({
        suppressed: true,
        suppression: {id: 'sup-1', justification: 'Reviewed and accepted.'},
      })
      expect(result.suppressions).toEqual({matched: 1, suppressed_findings: 1, unmatched: []})
    })
  })

  test('passes store diagnostics through when a misowned file sits in the store', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      // A different app directory gives the foreign results a different scope identity, so the copy is not overwritten.
      const other = await createFixture(root, 'other', 'other-app')
      await record(other, findingsDocument(other), 'other.json')
      const otherContext = await dependencies(root).context(other.appRoot)
      const context = await dependencies(root).context(fixture.appRoot)
      const foreign = (await enumerateAppDoctorResults(otherContext)).results[0]!.result
      await mkdir(resultsDirectory(context))
      await copyFile(resultPath(otherContext, foreign), resultPath(context, foreign))

      const result = await status(fixture)

      expect(result.store.state).toBe('present')
      expect(result.scopes).toEqual([])
      expect(result.diagnostics).toEqual([
        {source: 'store', code: 'misowned', message: expect.any(String), path: resultPath(context, foreign)},
      ])
    })
  })

  test('surfaces a malformed suppressions document as a diagnostic instead of failing', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      await record(fixture, withFinding(fixture))
      const context = await dependencies(root).context(fixture.appRoot)
      await writeFile(joinPath(context.storeDirectory, 'suppressions.json'), '{not json')

      const result = await status(fixture)

      expect(result.findings).toHaveLength(1)
      expect(result.findings[0]!.suppressed).toBe(false)
      expect(result.diagnostics).toEqual([
        {
          source: 'store',
          code: 'malformed',
          message: expect.any(String),
          path: expect.stringContaining('suppressions'),
        },
      ])
    })
  })

  test('aborts naming the store directory when the store is not a directory', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      const context = await dependencies(root).context(fixture.appRoot)
      await mkdir(joinPath(context.storeDirectory, '..'))
      await writeFile(context.storeDirectory, 'not a directory')

      const error = await expectAbort(status(fixture))

      expect(error.message).toContain(context.storeDirectory)
    })
  })

  test('resolves the same store when invoked from a subdirectory of the app', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      await record(fixture, withFinding(fixture))

      const fromRoot = await status(fixture)
      const fromSubdirectory = await status(fixture, joinPath(fixture.appRoot, 'web'))

      expect(fromSubdirectory).toEqual(fromRoot)
      expect(fromSubdirectory.scopes).toHaveLength(1)
    })
  })

  test('lists a reviewed subdirectory once, under its own directory, and omits the app root when it has no results', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root, 'repo', 'app', ['web'])
      await record(fixture, findingsDocument(fixture))

      const result = await status(fixture)

      expect(result.scopes).toHaveLength(1)
      const [scope] = result.scopes
      expect(scope!.scope_identity).toBe(fixture.instructions.scopes[0]!.scope_identity)
      expect(scope!.directory).toBe(joinPath(fixture.appRoot, 'web'))
      expect(scope!.directory_resolved).toBe(true)
      expect(scope!.checks).toHaveLength(fixture.instructions.checks.length)
      expect(result.scopes.map((entry) => entry.directory)).not.toContain(fixture.appRoot)
    })
  })

  test('keeps listing a scope whose directory has since been removed, still naming where it was', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root, 'repo', 'app', ['web'])
      await record(fixture, findingsDocument(fixture))
      await rmdir(joinPath(fixture.appRoot, 'web'))

      const result = await status(fixture)

      // The directory is projected from the recorded descriptor, not read from disk, so removal changes nothing.
      expect(result.scopes).toEqual([
        expect.objectContaining({
          scope_identity: fixture.instructions.scopes[0]!.scope_identity,
          directory: joinPath(fixture.appRoot, 'web'),
          directory_resolved: true,
        }),
      ])
      expect(result.scopes[0]!.checks).toHaveLength(fixture.instructions.checks.length)
    })
  })

  test('lists the app root first, then other scopes by directory', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      // A sibling of the app that sorts before it alphabetically, so directory order alone would not put the root first.
      const shared = await makeFixtureDirectory(joinPath(fixture.appRoot, '..'), 'aaa-shared')
      const sharedFixture = await createFixture(root, 'repo', 'app', [shared])
      const webFixture = await createFixture(root, 'repo', 'app', ['web'])
      await record(webFixture, findingsDocument(webFixture), 'web.json')
      await record(sharedFixture, findingsDocument(sharedFixture), 'shared.json')
      await record(fixture, findingsDocument(fixture))

      const result = await status(fixture)

      expect(result.scopes.map((scope) => scope.directory)).toEqual([
        fixture.appRoot,
        shared,
        joinPath(fixture.appRoot, 'web'),
      ])
    })
  })

  test('encodes through the JSON output schema and round-trips', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      await record(fixture, withFinding(fixture))

      const result = await status(fixture)

      const encoded = appDoctorStatusJsonOutputSchema.encode(result)
      expect(appDoctorStatusJsonOutputSchema.schema.parse(JSON.parse(encoded))).toEqual(result)
    })
  })
})

describe('writeAppDoctorStatusResult', () => {
  const result: AppDoctorStatusResult = {
    schema_version: 1,
    basis: 'stored-results',
    configuration: {identity: 'identity', path: '/app/shopify.app.toml', name: 'shopify.app.toml'},
    app_root: '/app',
    store: {directory: '/app/.shopify/app-doctor/store', state: 'missing'},
    scopes: [],
    findings: [],
    coverage: {
      static_result_count: 0,
      complete: false,
      files_skipped: 0,
      unsupported_languages: [],
      gaps: [],
      owners: [],
    },
    score: {status: 'withheld', reason: 'no_static_results'},
    suppressions: {matched: 0, suppressed_findings: 0, unmatched: []},
    diagnostics: [],
  }

  test('json prints the encoded result to stdout exactly once', () => {
    vi.mocked(outputResult).mockClear()
    vi.mocked(renderAppDoctorStatusReport).mockClear()

    writeAppDoctorStatusResult(result, 'json')

    expect(outputResult).toHaveBeenCalledTimes(1)
    expect(JSON.parse(vi.mocked(outputResult).mock.calls[0]![0] as string)).toEqual(result)
    expect(renderAppDoctorStatusReport).not.toHaveBeenCalled()
  })

  test('text delegates to the report presenter and writes nothing to stdout', () => {
    vi.mocked(outputResult).mockClear()
    vi.mocked(renderAppDoctorStatusReport).mockClear()

    writeAppDoctorStatusResult(result, 'text')

    expect(renderAppDoctorStatusReport).toHaveBeenCalledWith(result)
    expect(outputResult).not.toHaveBeenCalled()
  })
})

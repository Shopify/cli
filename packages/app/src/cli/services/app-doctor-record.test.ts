import {recordAppDoctorReview, writeAppDoctorRecordResult} from './app-doctor-record.js'
import {resolveAppDoctorContext, type ResolveAppDoctorContextOptions} from './app-doctor-context.js'
import {
  enumerateAppDoctorResults,
  getEngineVersion,
  loadChecks,
  replaceAppDoctorResults,
} from './app-doctor-engine/index.js'
import {resultLeaf} from './app-doctor-engine/store/codec.js'
import {generateAppDoctorInstructions} from './app-doctor-instructions.js'
import {appDoctorRecordJsonOutputSchema, type AppDoctorRecordResult} from './app-doctor-record-json.js'
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
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {describe, expect, test, vi} from 'vitest'
import type {Check} from './app-doctor-engine/index.js'
import type {AppDoctorInstructionsResult} from './app-doctor-instructions-json.js'

vi.mock('@shopify/cli-kit/node/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/ui')>()),
  renderSuccess: vi.fn(),
  renderWarning: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/output')>()),
  outputResult: vi.fn(),
}))

const PRODUCED_AT = new Date('2026-09-16T12:00:00.000Z')

/** A clock that moves forward on every read, so identical re-records are not accidentally byte-identical. */
function advancingClock(): () => Date {
  let ticks = 0
  return () => new Date(PRODUCED_AT.getTime() + ticks++ * 60_000)
}

interface Fixture {
  readonly root: string
  readonly appRoot: string
  readonly configurationPath: string
  readonly instructions: AppDoctorInstructionsResult
  /** The catalogue the instructions were generated from; recording must verify tokens against the same one. */
  readonly checks: ReadonlyMap<string, Check>
}

/** Generating and recording share `checks`; a small catalogue keeps each publication to a couple of files. */
function dependencies(root: string, checks: ReadonlyMap<string, Check> = smallCheckCatalogue()) {
  const appStorage = new LocalStorage<AppLocalStorageSchema>({cwd: joinPath(root, 'storage')})
  const resolveContext = (options: ResolveAppDoctorContextOptions) => resolveAppDoctorContext({...options, appStorage})
  const loadCatalogue = () => checks
  return {
    generate: {
      resolveContext,
      invocationDirectory: () => root,
      quote: (value: string) => `<${value}>`,
      loadChecks: loadCatalogue,
    },
    record: {resolveContext, now: advancingClock(), replaceAppDoctorResults, loadChecks: loadCatalogue},
    context: (directory: string) => resolveContext({directory, interactive: false}),
  }
}

/**
 * A git repository containing one linked app, with instructions already generated for the app-root scope
 * (or for `reviewDirectories`, relative to the app root, when given).
 */
async function createFixture(
  root: string,
  name = 'repo',
  appDirectory = 'app',
  reviewDirectories?: string[],
  checks: ReadonlyMap<string, Check> = smallCheckCatalogue(),
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
    {...dependencies(root, checks).generate, invocationDirectory: () => appRoot},
  )
  return {root, appRoot, configurationPath, instructions, checks}
}

type FindingsChecks = {check_id: string; outcome: string; inspected_files: string[]; findings: unknown[]}[]

/** Every check `not_applicable` unless overridden; the first check can be flipped to a finding. */
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

async function writeFindings(fixture: Fixture, document: unknown, name = 'findings.json'): Promise<string> {
  return writeFixtureFile(fixture.root, `reviews/${name}`, JSON.stringify(document))
}

async function record(
  fixture: Fixture,
  findingsPath: string,
  recordDependencies = dependencies(fixture.root, fixture.checks).record,
  token = fixture.instructions.scopes[0]!.token,
) {
  return recordAppDoctorReview(
    {directory: fixture.appRoot, reviews: [token], findings: [findingsPath], interactive: false},
    recordDependencies,
  )
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

describe('recordAppDoctorReview', () => {
  test('stores one agent result per check of the full catalogue and reports what was recorded', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      // The one end-to-end run against the real catalogue, so a stale or malformed embedded check still fails here.
      const fixture = await createFixture(root, 'repo', 'app', undefined, loadChecks())
      const findingsPath = await writeFindings(fixture, withFinding(fixture))

      const result = await record(fixture, findingsPath)

      const checkIds = [...loadChecks().keys()]
      expect(checkIds.length).toBeGreaterThan(2)
      expect(result.schema_version).toBe(1)
      expect(result.app_root).toBe(fixture.appRoot)
      expect(result.configuration).toEqual({
        identity: expect.any(String),
        path: fixture.configurationPath,
        name: 'shopify.app.toml',
        client_id: 'id-1',
      })
      expect(result.recorded).toHaveLength(1)
      expect(result.recorded[0]!.scope_identity).toBe(fixture.instructions.scopes[0]!.scope_identity)
      expect(result.recorded[0]!.directory).toBe(fixture.appRoot)
      expect(result.recorded[0]!.checks.map((check) => check.check_id)).toEqual(checkIds)
      expect(result.recorded[0]!.checks[0]).toEqual({
        check_id: checkIds[0],
        outcome: 'findings',
        finding_count: 1,
        status: 'created',
      })
      expect(new Set(result.recorded[0]!.checks.slice(1).map((check) => check.outcome))).toEqual(
        new Set(['not_applicable']),
      )
      expect(result.summary).toEqual({
        scopes: 1,
        findings: 1,
        suppressed_findings: 0,
        score: {status: 'withheld', reason: 'no_static_results'},
        static_coverage_complete: false,
      })
      expect(result.diagnostics).toEqual([])
      expect(result.next).toBe(`shopify app doctor status --path '${fixture.appRoot}' --config 'shopify.app.toml'`)

      const stored = await enumerateAppDoctorResults(await dependencies(root).context(fixture.appRoot))
      expect(stored.store).toBe('present')
      expect(stored.results).toHaveLength(checkIds.length)
      for (const {key, result: storedResult} of stored.results) {
        expect(key.mode).toBe('agent')
        expect(storedResult.produced_at).toBe(PRODUCED_AT.toISOString())
        expect(storedResult.engine.version).toBe(getEngineVersion())
      }
    })
  })

  test('re-recording is a fresh review: every result is replaced and carries the new produced_at', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      const recordDependencies = dependencies(root).record
      const findingsPath = await writeFindings(fixture, findingsDocument(fixture))
      await record(fixture, findingsPath, recordDependencies)

      const identical = await record(fixture, findingsPath, recordDependencies)
      expect(new Set(identical.recorded[0]!.checks.map((check) => check.status))).toEqual(new Set(['replaced']))

      const changedPath = await writeFindings(fixture, withFinding(fixture), 'changed.json')
      const changed = await record(fixture, changedPath, recordDependencies)
      expect(changed.recorded[0]!.checks[0]).toMatchObject({outcome: 'findings', status: 'replaced'})
      expect(new Set(changed.recorded[0]!.checks.slice(1).map((check) => check.status))).toEqual(new Set(['replaced']))

      // Three records, one minute apart: everything now carries the third clock reading.
      const stored = await enumerateAppDoctorResults(await dependencies(root).context(fixture.appRoot))
      const producedAt = new Set(stored.results.map((entry) => entry.result.produced_at))
      expect(producedAt).toEqual(new Set(['2026-09-16T12:02:00.000Z']))
    })
  })

  test('records a scope whose directory has since been deleted, omitting its directory', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root, 'repo', 'app', ['web'])
      const findingsPath = await writeFindings(fixture, findingsDocument(fixture))
      await rmdir(joinPath(fixture.appRoot, 'web'))

      const result = await record(fixture, findingsPath)

      expect(result.recorded).toHaveLength(1)
      expect(result.recorded[0]!.scope_identity).toBe(fixture.instructions.scopes[0]!.scope_identity)
      expect(result.recorded[0]!.directory).toBeUndefined()
      expect(new Set(result.recorded[0]!.checks.map((check) => check.status))).toEqual(new Set(['created']))
      const stored = await enumerateAppDoctorResults(await dependencies(root).context(fixture.appRoot))
      expect(stored.results).toHaveLength(fixture.instructions.checks.length)
    })
  })

  test('refuses --findings that points at a directory, naming the path', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      const directory = await makeFixtureDirectory(root, 'reviews')

      const error = await expectAbort(record(fixture, directory))

      expect(error.message).toContain(directory)
      expect(String(error.tryMessage)).toContain('--findings')
    })
  })

  test('reports every findings file problem alongside engine problems from the readable files', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      const mismatched = await writeFindings(fixture, {...findingsDocument(fixture), review: 'other-token'})
      const missing = joinPath(root, 'reviews', 'absent.json')

      const error = await expectAbort(
        recordAppDoctorReview(
          {
            directory: fixture.appRoot,
            reviews: [fixture.instructions.scopes[0]!.token, 'adr1.zzz'],
            findings: [mismatched, missing],
            interactive: false,
          },
          dependencies(root).record,
        ),
      )

      expect(error.message).toContain('Submission 1 (document_token_mismatch)')
      expect(error.message).toContain('Submission 2 (findings_file_missing)')
      expect(error.message).toContain(missing)
    })
  })

  test('explains a partial publication when a foreign guard blocks one result', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      // Three checks: one created, the blocked one, and one left unattempted behind it.
      const checks = new Map([...loadChecks()].slice(0, 3))
      const fixture = await createFixture(root, 'repo', 'app', undefined, checks)
      const findingsPath = await writeFindings(fixture, findingsDocument(fixture))
      const context = await dependencies(root).context(fixture.appRoot)
      const scopeIdentity = fixture.instructions.scopes[0]!.scope_identity
      const blockedCheck = fixture.instructions.checks[1]!.id
      const leaf = resultLeaf({scopeIdentity, checkId: blockedCheck, mode: 'agent'})
      await writeFixtureFile(context.storeDirectory, `.publication/${leaf}/lock`, 'foreign-writer-token')

      const error = await expectAbort(
        record(fixture, findingsPath, {
          ...dependencies(root, checks).record,
          // The real guard is exercised; only its wait budget is shortened so the test stays fast.
          replaceAppDoctorResults: (recordContext, mode, entries) =>
            replaceAppDoctorResults(recordContext, mode, entries, {lockWaitMilliseconds: 20}),
        }),
      )

      expect(error.message).toContain('only part')
      expect(error.message).toContain(`${fixture.instructions.checks[0]!.id} in scope ${scopeIdentity}: created`)
      expect(error.message).toContain(`${blockedCheck} in scope ${scopeIdentity}: failed`)
      expect(error.message).toContain('locked')
      expect(error.message).toContain('unattempted')
      expect(String(error.tryMessage)).toContain('Re-run')
      const stored = await enumerateAppDoctorResults(context)
      expect(stored.results.map((entry) => entry.key.checkId)).toEqual([fixture.instructions.checks[0]!.id])
    })
  })

  test('rejects mismatched --review and --findings counts before touching anything', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)

      const error = await expectAbort(
        recordAppDoctorReview(
          {directory: fixture.appRoot, reviews: ['a', 'b'], findings: ['/one.json'], interactive: false},
          dependencies(root).record,
        ),
      )

      expect(error.message).toContain('2 --review')
      expect(error.message).toContain('1 --findings')
      expect(String(error.tryMessage)).toContain('same order')
    })
  })

  test('rejects an empty submission list', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)

      const error = await expectAbort(
        recordAppDoctorReview(
          {directory: fixture.appRoot, reviews: [], findings: [], interactive: false},
          dependencies(root).record,
        ),
      )

      expect(error.message).toContain('--review')
      expect(String(error.tryMessage)).toContain('--findings')
    })
  })

  test('names a missing findings file', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      const missing = joinPath(root, 'reviews', 'absent.json')

      const error = await expectAbort(record(fixture, missing))

      expect(error.message).toContain(missing)
    })
  })

  test('refuses a findings file over the size bound', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      const path = joinPath(root, 'reviews', 'huge.json')
      await mkdir(joinPath(root, 'reviews'))
      await writeFile(path, ' '.repeat(5_000_001))

      const error = await expectAbort(record(fixture, path))

      expect(error.message).toContain(path)
      expect(error.message).toMatch(/too large|5,000,000|5000000/)
    })
  })

  test('refuses a findings file that is not JSON', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      const path = await writeFixtureFile(root, 'reviews/not-json.json', '{not json')

      const error = await expectAbort(record(fixture, path))

      expect(error.message).toContain(path)
      expect(error.message).toContain('JSON')
    })
  })

  test('lists every preparation problem and points at regenerating instructions', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      const findingsPath = await writeFindings(fixture, findingsDocument(fixture))
      const otherPath = await writeFindings(fixture, {schema_version: 1, review: 'adr1.zzz', checks: []}, 'other.json')

      const error = await expectAbort(
        recordAppDoctorReview(
          {
            directory: fixture.appRoot,
            reviews: ['adr1.zzz', fixture.instructions.scopes[0]!.token],
            findings: [otherPath, findingsPath],
            interactive: false,
          },
          dependencies(root).record,
        ),
      )

      expect(error.message).toContain('Submission 1')
      expect(error.message).toContain('review token')
      expect(error.message).not.toContain('adr1.zzz')
      expect(String(error.tryMessage)).toContain('shopify app doctor instructions')

      const stored = await enumerateAppDoctorResults(await dependencies(root).context(fixture.appRoot))
      expect(stored.results).toEqual([])
    })
  })

  test('rejects a document whose review token differs from --review', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      const document = {...findingsDocument(fixture), review: `${fixture.instructions.scopes[0]!.token}x`}
      const findingsPath = await writeFindings(fixture, document)

      const error = await expectAbort(record(fixture, findingsPath))

      expect(error.message).toContain('document_token_mismatch')
    })
  })

  test('passes store diagnostics through when a misowned file sits in the store', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      // A different app directory gives the foreign results a different scope identity, so the copy is not overwritten.
      const other = await createFixture(root, 'other', 'other-app')
      await record(other, await writeFindings(other, findingsDocument(other), 'other.json'))
      const otherContext = await dependencies(root).context(other.appRoot)
      const context = await dependencies(root).context(fixture.appRoot)
      const foreign = (await enumerateAppDoctorResults(otherContext)).results[0]!.result
      await mkdir(resultsDirectory(context))
      await copyFile(resultPath(otherContext, foreign), resultPath(context, foreign))

      const result = await record(fixture, await writeFindings(fixture, findingsDocument(fixture)))

      expect(result.diagnostics).toEqual([
        {source: 'store', code: 'misowned', message: expect.any(String), path: resultPath(context, foreign)},
      ])
      expect(result.summary.scopes).toBe(1)
    })
  })

  test('encodes through the JSON output schema and round-trips', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)

      const result = await record(fixture, await writeFindings(fixture, withFinding(fixture)))

      expect(JSON.parse(appDoctorRecordJsonOutputSchema.encode(result))).toEqual(result)
    })
  })
})

describe('writeAppDoctorRecordResult', () => {
  const result: AppDoctorRecordResult = {
    schema_version: 1,
    configuration: {identity: 'identity', path: '/app/shopify.app.toml', name: 'shopify.app.toml'},
    app_root: '/app',
    recorded: [
      {
        scope_identity: 'scope:abc',
        directory: '/app',
        checks: [
          {check_id: 'FIRST', outcome: 'findings', finding_count: 2, status: 'created'},
          {check_id: 'SECOND', outcome: 'clean', finding_count: 0, status: 'replaced'},
        ],
      },
    ],
    summary: {
      scopes: 1,
      findings: 2,
      suppressed_findings: 1,
      score: {status: 'withheld', reason: 'no_static_results'},
      static_coverage_complete: false,
    },
    diagnostics: [{source: 'store', code: 'misowned', message: 'Owned by another configuration.', path: '/x.json'}],
    next: "shopify app doctor status --path '/app' --config 'shopify.app.toml'",
  }

  test('json prints the encoded result to stdout exactly once', () => {
    vi.mocked(outputResult).mockClear()
    vi.mocked(renderSuccess).mockClear()

    writeAppDoctorRecordResult(result, 'json')

    expect(outputResult).toHaveBeenCalledTimes(1)
    expect(JSON.parse(vi.mocked(outputResult).mock.calls[0]![0] as string)).toEqual(result)
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('text renders a warning for diagnostics and a success banner, writing nothing to stdout', () => {
    vi.mocked(outputResult).mockClear()
    vi.mocked(renderSuccess).mockClear()
    vi.mocked(renderWarning).mockClear()

    writeAppDoctorRecordResult(result, 'text')

    expect(outputResult).not.toHaveBeenCalled()
    expect(renderWarning).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(vi.mocked(renderWarning).mock.calls[0]![0])).toContain('misowned')
    expect(renderSuccess).toHaveBeenCalledTimes(1)
    const options = vi.mocked(renderSuccess).mock.calls[0]![0]
    expect(options.headline).toBe('Recorded App Doctor agent review for shopify.app.toml')
    const rendered = JSON.stringify(options.body)
    expect(rendered).toContain('/app')
    expect(rendered).toContain('FIRST: findings (2 findings)')
    expect(rendered).toContain('SECOND: clean (0 findings)')
    expect(rendered).toContain('2 findings')
    expect(rendered).toContain('1 suppressed')
    expect(rendered).toContain('withheld')
    expect(rendered).toMatch(/stored/i)
    expect(rendered).toMatch(/no rescan/i)
    expect(rendered).toMatch(/static scan/i)
    expect(JSON.stringify(options.nextSteps)).toContain(result.next)
  })

  test('text skips the warning when there are no diagnostics', () => {
    vi.mocked(renderWarning).mockClear()

    writeAppDoctorRecordResult({...result, diagnostics: []}, 'text')

    expect(renderWarning).not.toHaveBeenCalled()
  })
})

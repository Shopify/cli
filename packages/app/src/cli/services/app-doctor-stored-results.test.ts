import {readAppDoctorStoredResults} from './app-doctor-stored-results.js'
import {resolveAppDoctorContext} from './app-doctor-context.js'
import {replaceAppDoctorResults} from './app-doctor-engine/index.js'
import {generateAppDoctorInstructions} from './app-doctor-instructions.js'
import {recordAppDoctorReview} from './app-doctor-record.js'
import {
  inCanonicalTemporaryDirectory,
  linkedConfiguration,
  makeFixtureDirectory,
  writeFixtureFile,
} from './app-doctor-engine/tests/context-test-helpers.js'
import {smallCheckCatalogue} from './app-doctor-engine/tests/store-fixtures.js'
import {AppLocalStorageSchema} from './local-storage.js'
import {mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import type {AppDoctorContext} from './app-doctor-engine/index.js'

const PRODUCED_AT = new Date('2026-09-16T12:00:00.000Z')

interface Fixture {
  readonly appRoot: string
  readonly context: AppDoctorContext
  readonly scopeIdentity: string
  readonly checkIds: string[]
  readonly record: () => Promise<unknown>
}

/** A git repository containing one linked app whose only review scope is the app root. */
async function createFixture(root: string): Promise<Fixture> {
  const repository = await makeFixtureDirectory(root, 'repo')
  await makeFixtureDirectory(repository, '.git')
  await writeFixtureFile(repository, 'app/shopify.app.toml', linkedConfiguration('id-1'))
  const appRoot = joinPath(repository, 'app')
  const appStorage = new LocalStorage<AppLocalStorageSchema>({cwd: joinPath(root, 'storage')})
  const resolveContext = (options: Parameters<typeof resolveAppDoctorContext>[0]) =>
    resolveAppDoctorContext({...options, appStorage})
  // Generating and recording share one small catalogue, so each publication writes a couple of files, not 33.
  const loadChecks = () => smallCheckCatalogue()
  const instructions = await generateAppDoctorInstructions(
    {directory: appRoot, interactive: false, format: 'text'},
    {resolveContext, invocationDirectory: () => appRoot, quote: (value: string) => `<${value}>`, loadChecks},
  )
  const scope = instructions.scopes[0]!
  const record = async () => {
    const findingsPath = await writeFixtureFile(
      root,
      'reviews/findings.json',
      JSON.stringify({
        schema_version: 1,
        review: scope.token,
        checks: instructions.checks.map((check) => ({
          check_id: check.id,
          outcome: 'not_applicable',
          inspected_files: [],
          findings: [],
        })),
      }),
    )
    return recordAppDoctorReview(
      {directory: appRoot, reviews: [scope.token], findings: [findingsPath], interactive: false},
      {resolveContext, now: () => PRODUCED_AT, replaceAppDoctorResults, loadChecks},
    )
  }
  return {
    appRoot,
    context: await resolveContext({directory: appRoot, interactive: false}),
    scopeIdentity: scope.scope_identity,
    checkIds: instructions.checks.map((check) => check.id),
    record,
  }
}

describe('readAppDoctorStoredResults', () => {
  test('reports a missing store with an interpretation that still lists the current app root scope', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)

      const read = await readAppDoctorStoredResults(fixture.context)

      expect(read.store).toBe('missing')
      expect(read.results).toEqual([])
      expect(read.interpretation.scopes).toEqual([
        expect.objectContaining({scopeIdentity: fixture.scopeIdentity, current: true, checks: []}),
      ])
      expect(read.interpretation.diagnostics).toEqual([])
      expect(read.directories).toEqual(new Map([[fixture.scopeIdentity, fixture.appRoot]]))
    })
  })

  test('interprets recorded results and maps every current scope to its directory', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      await fixture.record()

      const read = await readAppDoctorStoredResults(fixture.context)

      expect(read.store).toBe('present')
      expect(read.results.map((result) => result.check_id).sort()).toEqual([...fixture.checkIds].sort())
      expect(read.interpretation.scopes[0]!.checks.map((check) => check.checkId)).toEqual(fixture.checkIds)
      expect(read.directories.get(fixture.scopeIdentity)).toBe(fixture.appRoot)
    })
  })

  test('appends caller diagnostics after the store diagnostics, each mapped exactly once', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      await fixture.record()
      await writeFile(joinPath(fixture.context.storeDirectory, 'suppressions.json'), '{not json')
      const extra = {source: 'record' as const, code: 'stale', message: 'Replaced a stale result.', path: '/x.json'}

      const read = await readAppDoctorStoredResults(fixture.context, [extra])

      expect(read.interpretation.diagnostics).toEqual([
        {
          source: 'store',
          code: 'malformed',
          message: expect.any(String),
          path: expect.stringContaining('suppressions'),
        },
        extra,
      ])
    })
  })

  test('reports an unusable store as unavailable with its diagnostic and no results', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      await mkdir(joinPath(fixture.context.storeDirectory, '..'))
      await writeFile(fixture.context.storeDirectory, 'not a directory')

      const read = await readAppDoctorStoredResults(fixture.context)

      expect(read.store).toBe('unavailable')
      expect(read.results).toEqual([])
      // Both the results enumeration and the suppressions read report the same unusable store.
      const unusable = expect.objectContaining({source: 'store', path: fixture.context.storeDirectory})
      expect(read.interpretation.diagnostics).toEqual([unusable, unusable])
    })
  })
})

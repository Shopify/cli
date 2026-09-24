import {
  appSecurityArtifactPaths,
  readAppSecurityArtifactState,
  readTrace,
  withTracePublicationLock,
  writeAppSecurityArtifacts,
  writeSubmission,
  type ResolvedAppSecurityArtifactPaths,
} from './app-security-artifacts.js'
import {
  compileFindings,
  scanApp,
  SUBMISSION_SCHEMA_VERSION,
  type AppSecuritySubmission,
} from './app-security-engine/index.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import lockfile from 'proper-lockfile'
import {symlink, utimes} from 'node:fs/promises'

const submission = {
  schemaVersion: SUBMISSION_SCHEMA_VERSION,
  report: {metadata: {}},
} as AppSecuritySubmission

async function compileExecution(directory: string) {
  await writeFile(joinPath(directory, 'shopify.app.toml'), 'name = "Test"\nclient_id = "test"\n')
  const {scan} = await scanApp(directory)
  const compiled = await compileFindings(directory, {
    schema_version: 1,
    source_scan_id: scan.scan.input_hash,
    findings: [],
  })
  return {...compiled, elapsedMilliseconds: 1}
}

async function isTraceLocked(paths: ResolvedAppSecurityArtifactPaths): Promise<boolean> {
  return lockfile.check(paths.artifactDirectory, {lockfilePath: paths.traceLockPath})
}

describe('appSecurityArtifactPaths', () => {
  test('resolves every artifact under .shopify/app-security', () => {
    const paths = appSecurityArtifactPaths('/tmp/example-app')

    expect(paths).toEqual({
      artifactDirectory: joinPath('/tmp/example-app', '.shopify', 'app-security'),
      tracePath: joinPath('/tmp/example-app', '.shopify', 'app-security', 'trace.json'),
      reviewPath: joinPath('/tmp/example-app', '.shopify', 'app-security', 'review.json'),
      findingsPath: joinPath('/tmp/example-app', '.shopify', 'app-security', 'findings.json'),
      submissionPath: joinPath('/tmp/example-app', '.shopify', 'app-security', 'submission.json'),
      traceLockPath: joinPath('/tmp/example-app', '.shopify', 'app-security', 'trace.lock'),
    })
  })
})

describe('readTrace', () => {
  test('returns a validated v2 trace', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(joinPath(directory, 'shopify.app.toml'), 'name = "Test"\nclient_id = "test"\n')
      const {trace} = await scanApp(directory)
      const path = joinPath(directory, 'trace.json')
      await writeFile(path, `${JSON.stringify(trace)}\n`)

      await expect(readTrace(path)).resolves.toEqual({status: 'ok', trace})
    })
  })

  test('returns missing when the file does not exist', async () => {
    await inTemporaryDirectory(async (directory) => {
      await expect(readTrace(joinPath(directory, 'trace.json'))).resolves.toEqual({status: 'missing'})
    })
  })

  test('returns a parse error for invalid JSON', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'trace.json')
      await writeFile(path, '{invalid')

      const result = await readTrace(path)

      expect(result.status).toBe('invalid')
      if (result.status === 'invalid') expect(result.errors[0]).toContain('Could not parse JSON')
    })
  })

  test('preserves every validateTrace schema error as a list', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'trace.json')
      await writeFile(path, '{}')

      const result = await readTrace(path)

      expect(result.status).toBe('invalid')
      if (result.status === 'invalid') {
        expect(result.errors.length).toBeGreaterThan(1)
        expect(result.errors).toContain('unsupported schema_version: undefined')
      }
    })
  })

  test('returns invalid for an unreadable artifact path', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'trace.json')
      await mkdir(path)

      const result = await readTrace(path)

      expect(result.status).toBe('invalid')
      if (result.status === 'invalid') expect(result.errors).toHaveLength(1)
    })
  })

  test('rejects a real file larger than 5 MB before parsing', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'trace.json')
      await writeFile(path, 'x'.repeat(5_000_001))

      await expect(readTrace(path)).resolves.toEqual({
        status: 'invalid',
        errors: ['The trace file is larger than 5 MB.'],
      })
    })
  })
})

describe('writeAppSecurityArtifacts', () => {
  test('clean writes a fresh scan before removing only stale default artifacts', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(joinPath(directory, 'shopify.app.toml'), 'name = "Test"\nclient_id = "test"\n')
      const execution = {...(await scanApp(directory)), elapsedMilliseconds: 1}
      const paths = appSecurityArtifactPaths(directory)
      await mkdir(paths.artifactDirectory)
      await writeFile(paths.findingsPath, '{"findings":[]}')
      await writeFile(paths.submissionPath, '{"submission":true}')
      const unknownPath = joinPath(paths.artifactDirectory, 'notes.txt')
      const customFindingsPath = joinPath(directory, 'custom-findings.json')
      await writeFile(unknownPath, 'keep')
      await writeFile(customFindingsPath, 'keep')

      await writeAppSecurityArtifacts(execution, {clean: true})

      await expect(fileExists(paths.findingsPath)).resolves.toBe(false)
      await expect(fileExists(paths.submissionPath)).resolves.toBe(false)
      await expect(readFile(unknownPath)).resolves.toBe('keep')
      await expect(readFile(customFindingsPath)).resolves.toBe('keep')
      await expect(readTrace(paths.tracePath)).resolves.toMatchObject({status: 'ok'})
      await expect(fileExists(paths.reviewPath)).resolves.toBe(true)
    })
  })

  test('rejects clean compilation before touching any existing artifact', async () => {
    await inTemporaryDirectory(async (directory) => {
      const execution = await compileExecution(directory)
      const paths = appSecurityArtifactPaths(directory)
      await mkdir(paths.artifactDirectory)
      const existingArtifacts = {
        [paths.tracePath]: '{"trace":"stale"}',
        [paths.reviewPath]: '{"review":"stale"}',
        [paths.findingsPath]: '{"findings":"stale"}',
        [paths.submissionPath]: '{"submission":"stale"}',
      }
      for (const [path, content] of Object.entries(existingArtifacts)) {
        // eslint-disable-next-line no-await-in-loop
        await writeFile(path, content)
      }

      await expect(writeAppSecurityArtifacts(execution, {clean: true})).rejects.toThrow(AbortError)

      for (const [path, content] of Object.entries(existingArtifacts)) {
        // eslint-disable-next-line no-await-in-loop
        await expect(readFile(path)).resolves.toBe(content)
      }
    })
  })

  test('rejects clean compilation without creating the artifact directory', async () => {
    await inTemporaryDirectory(async (directory) => {
      const execution = await compileExecution(directory)
      const paths = appSecurityArtifactPaths(directory)

      await expect(writeAppSecurityArtifacts(execution, {clean: true})).rejects.toThrow(AbortError)

      await expect(fileExists(paths.artifactDirectory)).resolves.toBe(false)
    })
  })

  test('clean surfaces deletion failures after writing the replacement artifacts', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(joinPath(directory, 'shopify.app.toml'), 'name = "Test"\nclient_id = "test"\n')
      const execution = {...(await scanApp(directory)), elapsedMilliseconds: 1}
      const paths = appSecurityArtifactPaths(directory)
      await mkdir(paths.findingsPath)

      await expect(writeAppSecurityArtifacts(execution, {clean: true})).rejects.toThrow(
        `Could not remove stale App Security artifact at ${paths.findingsPath}`,
      )
      await expect(readTrace(paths.tracePath)).resolves.toMatchObject({status: 'ok'})
      await expect(fileExists(paths.reviewPath)).resolves.toBe(true)
    })
  })
})

describe('withTracePublicationLock', () => {
  test('releases the lock when publication fails', async () => {
    await inTemporaryDirectory(async (directory) => {
      const paths = appSecurityArtifactPaths(directory)

      await expect(
        withTracePublicationLock(directory, async () => {
          throw new Error('publication failed')
        }),
      ).rejects.toThrow('publication failed')

      await expect(isTraceLocked(paths)).resolves.toBe(false)
    })
  })

  test('reports a busy trace without publishing while another publication holds the lock', async () => {
    await inTemporaryDirectory(async (directory) => {
      let published = false

      await withTracePublicationLock(directory, async () => {
        await expect(
          withTracePublicationLock(
            directory,
            async () => {
              published = true
            },
            {retries: 0},
          ),
        ).rejects.toMatchObject({
          constructor: AbortError,
          message: 'Another Shopify CLI command is updating the App Security trace.',
          tryMessage: 'Wait for the other command to finish, then run this command again.',
        })
      })

      expect(published).toBe(false)
    })
  })

  test('keeps the publication failure when releasing the lock also fails', async () => {
    await inTemporaryDirectory(async (directory) => {
      await expect(
        withTracePublicationLock(directory, async (paths) => {
          // Releasing the lock early makes the later release fail with "already released".
          await lockfile.unlock(paths.artifactDirectory, {lockfilePath: paths.traceLockPath})
          throw new Error('publication failed')
        }),
      ).rejects.toThrow('publication failed')
    })
  })

  test('reclaims a lock abandoned by a crashed process', async () => {
    await inTemporaryDirectory(async (directory) => {
      const paths = appSecurityArtifactPaths(directory)
      await mkdir(paths.traceLockPath)
      const abandonedAt = new Date(Date.now() - 60_000)
      await utimes(paths.traceLockPath, abandonedAt, abandonedAt)

      await expect(withTracePublicationLock(directory, async () => 'published', {retries: 0})).resolves.toBe(
        'published',
      )
    })
  })

  test('refuses a symbolic link at the lock path', async () => {
    await inTemporaryDirectory(async (directory) => {
      await inTemporaryDirectory(async (externalDirectory) => {
        const paths = appSecurityArtifactPaths(directory)
        await mkdir(paths.artifactDirectory)
        await symlink(externalDirectory, paths.traceLockPath, 'dir')
        let published = false

        await expect(
          withTracePublicationLock(directory, async () => {
            published = true
          }),
        ).rejects.toMatchObject({
          constructor: AbortError,
          message: `Refusing to write App Security artifacts through a symbolic link or outside the app: ${paths.traceLockPath}`,
        })
        expect(published).toBe(false)
      })
    })
  })
})

describe('writeAppSecurityArtifacts atomic replacement', () => {
  test('readers observe either the complete previous trace or the complete replacement', async () => {
    await inTemporaryDirectory(async (directory) => {
      const compiled = await compileExecution(directory)
      const scanned = {...(await scanApp(directory)), elapsedMilliseconds: 1}
      const paths = appSecurityArtifactPaths(directory)
      await writeAppSecurityArtifacts(scanned)
      const previousContents = await readFile(paths.tracePath)
      const publicationState = {settled: false}

      const publication = writeAppSecurityArtifacts(compiled).finally(() => {
        publicationState.settled = true
      })
      const observedContents: string[] = []
      while (!publicationState.settled) {
        // Reads must interleave with publication to observe intermediate states.
        // eslint-disable-next-line no-await-in-loop
        observedContents.push(await readFile(paths.tracePath))
      }
      await publication
      const replacementContents = await readFile(paths.tracePath)

      expect(replacementContents).not.toBe(previousContents)
      expect(observedContents.length).toBeGreaterThan(0)
      for (const contents of observedContents) {
        expect([previousContents, replacementContents]).toContain(contents)
      }
    })
  })
})

describe('readAppSecurityArtifactState', () => {
  test('reports a missing trace and findings file', async () => {
    await inTemporaryDirectory(async (directory) => {
      await expect(readAppSecurityArtifactState(appSecurityArtifactPaths(directory))).resolves.toEqual({
        traceDigest: undefined,
        findingsExist: false,
      })
    })
  })

  test('changes when the trace is replaced or findings appear', async () => {
    await inTemporaryDirectory(async (directory) => {
      const paths = appSecurityArtifactPaths(directory)
      await mkdir(paths.artifactDirectory)
      await writeFile(paths.tracePath, '{"trace":"first"}')
      const first = await readAppSecurityArtifactState(paths)

      await writeFile(paths.tracePath, '{"trace":"second"}')
      const replaced = await readAppSecurityArtifactState(paths)
      await writeFile(paths.findingsPath, '{"findings":[]}')
      const withFindings = await readAppSecurityArtifactState(paths)

      expect(first.traceDigest).toEqual(expect.any(String))
      expect(replaced.traceDigest).not.toBe(first.traceDigest)
      expect(withFindings).toEqual({traceDigest: replaced.traceDigest, findingsExist: true})
      await expect(readAppSecurityArtifactState(paths)).resolves.toEqual(withFindings)
    })
  })
})

describe('writeSubmission', () => {
  test('creates parent directories and writes the provided bytes without re-encoding', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, '.shopify', 'app-security', 'submission.json')

      const bytes = Buffer.from(`${JSON.stringify(submission)}\n`, 'utf8')
      await writeSubmission(directory, bytes)

      await expect(readFile(path)).resolves.toBe(bytes.toString())
    })
  })
})

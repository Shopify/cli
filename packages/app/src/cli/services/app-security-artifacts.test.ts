import {
  appSecurityArtifactPaths,
  readTrace,
  writeAppSecurityArtifacts,
  writeSubmission,
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

describe('appSecurityArtifactPaths', () => {
  test('resolves every artifact under .shopify/app-security', () => {
    const paths = appSecurityArtifactPaths('/tmp/example-app')

    expect(paths).toEqual({
      artifactDirectory: joinPath('/tmp/example-app', '.shopify', 'app-security'),
      tracePath: joinPath('/tmp/example-app', '.shopify', 'app-security', 'trace.json'),
      reviewPath: joinPath('/tmp/example-app', '.shopify', 'app-security', 'review.json'),
      findingsPath: joinPath('/tmp/example-app', '.shopify', 'app-security', 'findings.json'),
      submissionPath: joinPath('/tmp/example-app', '.shopify', 'app-security', 'submission.json'),
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

import {
  appSecurityArtifactPaths,
  readDeterministicFindings,
  writeAppSecurityArtifacts,
  writeSubmission,
} from './app-security-artifacts.js'
import {scanApp, SUBMISSION_SCHEMA_VERSION, type AppSecuritySubmission} from './app-security-engine/index.js'
import {fileExists, inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'

const submission = {
  schemaVersion: SUBMISSION_SCHEMA_VERSION,
  report: {metadata: {}},
} as AppSecuritySubmission

describe('appSecurityArtifactPaths', () => {
  test('resolves every artifact under .shopify/app-security', () => {
    const paths = appSecurityArtifactPaths('/tmp/example-app')

    expect(paths).toEqual({
      artifactDirectory: joinPath('/tmp/example-app', '.shopify', 'app-security'),
      deterministicFindingsPath: joinPath(
        '/tmp/example-app',
        '.shopify',
        'app-security',
        'deterministic-findings.json',
      ),
      agentChecksPath: joinPath('/tmp/example-app', '.shopify', 'app-security', 'agent-checks.json'),
      findingsPath: joinPath('/tmp/example-app', '.shopify', 'app-security', 'findings.json'),
      submissionPath: joinPath('/tmp/example-app', '.shopify', 'app-security', 'submission.json'),
    })
  })
})

describe('readDeterministicFindings', () => {
  test('returns ok with deterministic findings written by a scan', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(joinPath(directory, 'shopify.app.toml'), 'name = "Test"\nclient_id = "test"\n')
      const {artifact} = await scanApp(directory)
      const path = joinPath(directory, 'deterministic-findings.json')
      await writeFile(path, `${JSON.stringify(artifact)}\n`)

      await expect(readDeterministicFindings(path)).resolves.toEqual({status: 'ok', value: artifact})
    })
  })

  test('returns missing when the file does not exist', async () => {
    await inTemporaryDirectory(async (directory) => {
      await expect(readDeterministicFindings(joinPath(directory, 'deterministic-findings.json'))).resolves.toEqual({
        status: 'missing',
      })
    })
  })

  test('returns invalid for malformed JSON', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'deterministic-findings.json')
      await writeFile(path, '{invalid')

      await expect(readDeterministicFindings(path)).resolves.toEqual({
        status: 'invalid',
        message: expect.stringContaining('Could not parse JSON'),
      })
    })
  })

  test('returns invalid with every schema error for an unrecognized artifact', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'deterministic-findings.json')
      await writeFile(path, '{"schema_version":3}')

      await expect(readDeterministicFindings(path)).resolves.toEqual({
        status: 'invalid',
        message: 'unsupported schema_version: 3 (expected 1); findings must be an array',
      })
    })
  })

  test('returns invalid for an unreadable path', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'deterministic-findings.json')
      await mkdir(path)

      await expect(readDeterministicFindings(path)).resolves.toEqual({
        status: 'invalid',
        message: expect.stringContaining('Could not read the file'),
      })
    })
  })

  test('rejects a file larger than 5 MB before parsing', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'deterministic-findings.json')
      await writeFile(path, 'x'.repeat(5_000_001))

      await expect(readDeterministicFindings(path)).resolves.toEqual({
        status: 'invalid',
        message: 'The file is larger than 5 MB.',
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
      await expect(readDeterministicFindings(paths.deterministicFindingsPath)).resolves.toMatchObject({status: 'ok'})
      await expect(fileExists(paths.agentChecksPath)).resolves.toBe(true)
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
      await expect(readDeterministicFindings(paths.deterministicFindingsPath)).resolves.toMatchObject({status: 'ok'})
      await expect(fileExists(paths.agentChecksPath)).resolves.toBe(true)
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

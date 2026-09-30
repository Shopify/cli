import {
  appSecurityArtifactPaths,
  cleanAppSecurityArtifacts,
  readAgentFindings,
  readDeterministicFindings,
  writeAgentFindings,
  writeCheckArtifacts,
  writeSubmission,
} from './app-security-artifacts.js'
import {
  scanApp,
  SUBMISSION_SCHEMA_VERSION,
  type AgentFindingsArtifact,
  type AppSecuritySubmission,
} from './app-security-engine/index.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import {symlink} from 'node:fs/promises'

const submission = {
  schemaVersion: SUBMISSION_SCHEMA_VERSION,
  report: {metadata: {}},
} as AppSecuritySubmission

const agentFindings: AgentFindingsArtifact = {
  schema_version: 1,
  engine: {name: 'shopify-app-security', version: '1.2.3'},
  recorded_at: '2026-08-24T00:00:00.000Z',
  project: {commit: null, dirty: null},
  checks: [],
}

async function scanTestApp(directory: string) {
  await writeFile(joinPath(directory, 'shopify.app.toml'), 'name = "Test"\nclient_id = "test"\n')
  return scanApp(directory)
}

async function writeEveryArtifact(directory: string): Promise<string[]> {
  const paths = appSecurityArtifactPaths(directory)
  const artifactPaths = [
    paths.deterministicFindingsPath,
    paths.agentChecksPath,
    paths.agentFindingsPath,
    paths.submissionPath,
    ...paths.legacyPaths,
  ]
  await mkdir(paths.artifactDirectory)
  await Promise.all(artifactPaths.map((path) => writeFile(path, '{}')))
  return artifactPaths
}

describe('appSecurityArtifactPaths', () => {
  test('resolves every current and legacy artifact under .shopify/app-security', () => {
    const artifactDirectory = joinPath('/tmp/example-app', '.shopify', 'app-security')

    expect(appSecurityArtifactPaths('/tmp/example-app')).toEqual({
      artifactDirectory,
      deterministicFindingsPath: joinPath(artifactDirectory, 'deterministic-findings.json'),
      agentChecksPath: joinPath(artifactDirectory, 'agent-checks.json'),
      agentFindingsPath: joinPath(artifactDirectory, 'agent-findings.json'),
      submissionPath: joinPath(artifactDirectory, 'submission.json'),
      legacyPaths: [
        joinPath(artifactDirectory, 'trace.json'),
        joinPath(artifactDirectory, 'review.json'),
        joinPath(artifactDirectory, 'findings.json'),
      ],
    })
  })
})

describe('readDeterministicFindings', () => {
  test('returns ok with deterministic findings written by a scan', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {artifact, agentChecks} = await scanTestApp(directory)
      const {deterministicFindingsPath} = await writeCheckArtifacts(directory, {artifact, agentChecks})

      await expect(readDeterministicFindings(deterministicFindingsPath)).resolves.toEqual({
        status: 'ok',
        value: artifact,
      })
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

describe('readAgentFindings', () => {
  test('returns ok with agent findings written by writeAgentFindings', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = await writeAgentFindings(directory, agentFindings)

      expect(path).toBe(appSecurityArtifactPaths(directory).agentFindingsPath)
      await expect(readAgentFindings(path)).resolves.toEqual({status: 'ok', value: agentFindings})
    })
  })

  test('returns missing when the file does not exist', async () => {
    await inTemporaryDirectory(async (directory) => {
      await expect(readAgentFindings(joinPath(directory, 'agent-findings.json'))).resolves.toEqual({
        status: 'missing',
      })
    })
  })

  test('returns invalid for malformed JSON', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'agent-findings.json')
      await writeFile(path, '{invalid')

      await expect(readAgentFindings(path)).resolves.toEqual({
        status: 'invalid',
        message: expect.stringContaining('Could not parse JSON'),
      })
    })
  })

  test('returns invalid for JSON that is not an object', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'agent-findings.json')
      await writeFile(path, '[]')

      await expect(readAgentFindings(path)).resolves.toEqual({
        status: 'invalid',
        message: 'agent findings must be a JSON object',
      })
    })
  })

  test('returns invalid for an unsupported schema version', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'agent-findings.json')
      await writeFile(path, '{"schema_version":2,"checks":[]}')

      await expect(readAgentFindings(path)).resolves.toEqual({
        status: 'invalid',
        message: 'unsupported schema_version: 2 (expected 1)',
      })
    })
  })
})

describe('writeCheckArtifacts', () => {
  test('writes deterministic-findings.json and agent-checks.json', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {artifact, agentChecks} = await scanTestApp(directory)
      const paths = appSecurityArtifactPaths(directory)

      await expect(writeCheckArtifacts(directory, {artifact, agentChecks})).resolves.toEqual({
        deterministicFindingsPath: paths.deterministicFindingsPath,
        agentChecksPath: paths.agentChecksPath,
      })

      expect(JSON.parse(await readFile(paths.deterministicFindingsPath))).toEqual(artifact)
      expect(JSON.parse(await readFile(paths.agentChecksPath))).toEqual(agentChecks)
    })
  })

  test('overwrites earlier check artifacts and leaves agent-findings.json untouched', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {artifact, agentChecks} = await scanTestApp(directory)
      const paths = appSecurityArtifactPaths(directory)
      await mkdir(paths.artifactDirectory)
      await writeFile(paths.deterministicFindingsPath, '{"stale":true}')
      await writeFile(paths.agentChecksPath, '{"stale":true}')
      await writeFile(paths.agentFindingsPath, '{"recorded":"by the agent"}')

      await writeCheckArtifacts(directory, {artifact, agentChecks})

      expect(JSON.parse(await readFile(paths.deterministicFindingsPath))).toEqual(artifact)
      expect(JSON.parse(await readFile(paths.agentChecksPath))).toEqual(agentChecks)
      await expect(readFile(paths.agentFindingsPath)).resolves.toBe('{"recorded":"by the agent"}')
    })
  })

  test('refuses to write through a .shopify symlink that targets outside the app', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {artifact, agentChecks} = await scanTestApp(directory)
      await inTemporaryDirectory(async (externalDirectory) => {
        await symlink(externalDirectory, joinPath(directory, '.shopify'), 'dir')

        await expect(writeCheckArtifacts(directory, {artifact, agentChecks})).rejects.toMatchObject({
          constructor: AbortError,
          message: expect.stringMatching(/outside the app/),
        })
        await expect(
          fileExists(joinPath(externalDirectory, 'app-security', 'deterministic-findings.json')),
        ).resolves.toBe(false)
      })
    })
  })
})

describe('cleanAppSecurityArtifacts', () => {
  test('removes every current and legacy artifact and returns the removed paths', async () => {
    await inTemporaryDirectory(async (directory) => {
      const artifactPaths = await writeEveryArtifact(directory)
      const unrelatedPath = joinPath(appSecurityArtifactPaths(directory).artifactDirectory, 'notes.txt')
      await writeFile(unrelatedPath, 'keep')

      await expect(cleanAppSecurityArtifacts(directory)).resolves.toEqual(artifactPaths)

      const remaining = await Promise.all(artifactPaths.map((path) => fileExists(path)))
      expect(remaining.every((exists) => !exists)).toBe(true)
      await expect(readFile(unrelatedPath)).resolves.toBe('keep')
    })
  })

  test('returns only the artifacts that existed', async () => {
    await inTemporaryDirectory(async (directory) => {
      const paths = appSecurityArtifactPaths(directory)
      await mkdir(paths.artifactDirectory)
      await writeFile(paths.agentFindingsPath, '{}')
      await writeFile(joinPath(paths.artifactDirectory, 'trace.json'), '{}')

      await expect(cleanAppSecurityArtifacts(directory)).resolves.toEqual([
        paths.agentFindingsPath,
        joinPath(paths.artifactDirectory, 'trace.json'),
      ])
    })
  })

  test('returns an empty list without creating the artifact directory when none exist', async () => {
    await inTemporaryDirectory(async (directory) => {
      await expect(cleanAppSecurityArtifacts(directory)).resolves.toEqual([])
      await expect(fileExists(appSecurityArtifactPaths(directory).artifactDirectory)).resolves.toBe(false)
    })
  })

  test('returns an empty list when the artifact directory is empty', async () => {
    await inTemporaryDirectory(async (directory) => {
      await mkdir(appSecurityArtifactPaths(directory).artifactDirectory)

      await expect(cleanAppSecurityArtifacts(directory)).resolves.toEqual([])
    })
  })

  test('refuses a .shopify symlink that targets outside the app without deleting its files', async () => {
    await inTemporaryDirectory(async (directory) => {
      await inTemporaryDirectory(async (externalDirectory) => {
        const externalScanPath = joinPath(externalDirectory, 'app-security', 'deterministic-findings.json')
        await mkdir(joinPath(externalDirectory, 'app-security'))
        await writeFile(externalScanPath, '{}')
        await symlink(externalDirectory, joinPath(directory, '.shopify'), 'dir')

        await expect(cleanAppSecurityArtifacts(directory)).rejects.toMatchObject({
          constructor: AbortError,
          message: expect.stringMatching(/symbolic link/),
        })
        await expect(fileExists(externalScanPath)).resolves.toBe(true)
      })
    })
  })

  test('removes an artifact symlink without deleting its target', async () => {
    await inTemporaryDirectory(async (directory) => {
      await inTemporaryDirectory(async (externalDirectory) => {
        const paths = appSecurityArtifactPaths(directory)
        const targetPath = joinPath(externalDirectory, 'deterministic-findings.json')
        await writeFile(targetPath, 'keep')
        await mkdir(paths.artifactDirectory)
        await symlink(targetPath, paths.deterministicFindingsPath, 'file')

        await expect(cleanAppSecurityArtifacts(directory)).resolves.toEqual([paths.deterministicFindingsPath])
        await expect(readFile(targetPath)).resolves.toBe('keep')
      })
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

import {
  appSecurityArtifactPaths,
  cleanAppSecurityArtifacts,
  readFindingsDocument,
  writeAgentFindings,
  writeCheckArtifacts,
} from './app-security-artifacts.js'
import {scanApp} from './app-security-engine/index.js'
import {agentFindingsDocument} from './app-security-engine/tests/fixtures/findings-documents.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import {symlink} from 'node:fs/promises'

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
      legacyPaths: [
        joinPath(artifactDirectory, 'trace.json'),
        joinPath(artifactDirectory, 'review.json'),
        joinPath(artifactDirectory, 'findings.json'),
      ],
    })
  })
})

describe('readFindingsDocument', () => {
  test('returns ok with the deterministic document written by check', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {deterministicFindings, agentChecks} = await scanTestApp(directory)
      const {deterministicFindingsPath} = await writeCheckArtifacts(directory, {deterministicFindings, agentChecks})

      await expect(readFindingsDocument(deterministicFindingsPath, 'deterministic')).resolves.toEqual({
        status: 'ok',
        value: deterministicFindings,
      })
    })
  })

  test('returns ok with the agent document written by writeAgentFindings', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = await writeAgentFindings(directory, agentFindingsDocument)

      expect(path).toBe(appSecurityArtifactPaths(directory).agentFindingsPath)
      await expect(readFindingsDocument(path, 'agent')).resolves.toEqual({status: 'ok', value: agentFindingsDocument})
    })
  })

  test('narrows the document to the expected source so callers need no further checks', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {deterministicFindings, agentChecks} = await scanTestApp(directory)
      const {deterministicFindingsPath} = await writeCheckArtifacts(directory, {deterministicFindings, agentChecks})
      const agentFindingsPath = await writeAgentFindings(directory, agentFindingsDocument)

      const deterministic = await readFindingsDocument(deterministicFindingsPath, 'deterministic')
      const agent = await readFindingsDocument(agentFindingsPath, 'agent')

      // Source-specific fields compile without narrowing on `source`.
      expect(deterministic.status === 'ok' && deterministic.value.detection).toEqual(deterministicFindings.detection)
      expect(agent.status === 'ok' && agent.value.engine).toEqual(agentFindingsDocument.engine)
    })
  })

  test('returns invalid when the document comes from the other source', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = await writeAgentFindings(directory, agentFindingsDocument)

      await expect(readFindingsDocument(path, 'deterministic')).resolves.toEqual({
        status: 'invalid',
        errors: ['source is "agent", but this file must hold "deterministic" findings.'],
      })
    })
  })

  test('returns missing when the file does not exist', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'deterministic-findings.json')

      await expect(readFindingsDocument(path, 'deterministic')).resolves.toEqual({status: 'missing'})
    })
  })

  test('returns invalid for malformed JSON', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'agent-findings.json')
      await writeFile(path, '{invalid')

      await expect(readFindingsDocument(path, 'agent')).resolves.toEqual({
        status: 'invalid',
        errors: [expect.stringContaining('Could not parse JSON')],
      })
    })
  })

  test('returns invalid with every translation error, without the path', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'agent-findings.json')
      const document = {...agentFindingsDocument, engine: {name: 'other'}, checks: [{id: 'X', status: 'skipped'}]}
      await writeFile(path, JSON.stringify(document))

      const result = await readFindingsDocument(path, 'agent')

      expect(result.status).toBe('invalid')
      if (result.status !== 'invalid') return
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^engine\.name: /),
          expect.stringMatching(/^engine\.version: /),
          expect.stringMatching(/^checks\[0\]\.status: /),
          expect.stringMatching(/^checks\[0\]\.snapshot: /),
        ]),
      )
      for (const error of result.errors) expect(error).not.toContain(path)
    })
  })

  test('returns invalid for an unsupported schema version', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'deterministic-findings.json')
      await writeFile(path, '{"schema_version":3}')

      await expect(readFindingsDocument(path, 'deterministic')).resolves.toEqual({
        status: 'invalid',
        errors: ['unsupported schema_version: 3 (expected 1)'],
      })
    })
  })

  test('returns invalid for JSON that is not an object', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'agent-findings.json')
      await writeFile(path, '[]')

      await expect(readFindingsDocument(path, 'agent')).resolves.toEqual({
        status: 'invalid',
        errors: ['expected a JSON object, received array'],
      })
    })
  })

  test('returns invalid for an unreadable path', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'deterministic-findings.json')
      await mkdir(path)

      await expect(readFindingsDocument(path, 'deterministic')).resolves.toEqual({
        status: 'invalid',
        errors: [expect.stringContaining('Could not read the file')],
      })
    })
  })

  test('rejects a file larger than 5 MB before parsing', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'deterministic-findings.json')
      await writeFile(path, 'x'.repeat(5_000_001))

      await expect(readFindingsDocument(path, 'deterministic')).resolves.toEqual({
        status: 'invalid',
        errors: ['The file is larger than 5 MB.'],
      })
    })
  })
})

describe('writeCheckArtifacts', () => {
  test('writes deterministic-findings.json and agent-checks.json', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {deterministicFindings, agentChecks} = await scanTestApp(directory)
      const paths = appSecurityArtifactPaths(directory)

      await expect(writeCheckArtifacts(directory, {deterministicFindings, agentChecks})).resolves.toEqual({
        deterministicFindingsPath: paths.deterministicFindingsPath,
        agentChecksPath: paths.agentChecksPath,
      })

      expect(JSON.parse(await readFile(paths.deterministicFindingsPath))).toEqual(deterministicFindings)
      expect(JSON.parse(await readFile(paths.agentChecksPath))).toEqual(agentChecks)
    })
  })

  test('overwrites earlier check artifacts and leaves agent-findings.json untouched', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {deterministicFindings, agentChecks} = await scanTestApp(directory)
      const paths = appSecurityArtifactPaths(directory)
      await mkdir(paths.artifactDirectory)
      await writeFile(paths.deterministicFindingsPath, '{"stale":true}')
      await writeFile(paths.agentChecksPath, '{"stale":true}')
      await writeFile(paths.agentFindingsPath, '{"recorded":"by the agent"}')

      await writeCheckArtifacts(directory, {deterministicFindings, agentChecks})

      expect(JSON.parse(await readFile(paths.deterministicFindingsPath))).toEqual(deterministicFindings)
      expect(JSON.parse(await readFile(paths.agentChecksPath))).toEqual(agentChecks)
      await expect(readFile(paths.agentFindingsPath)).resolves.toBe('{"recorded":"by the agent"}')
    })
  })

  test('refuses to write through a .shopify symlink that targets outside the app', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {deterministicFindings, agentChecks} = await scanTestApp(directory)
      await inTemporaryDirectory(async (externalDirectory) => {
        await symlink(externalDirectory, joinPath(directory, '.shopify'), 'dir')

        await expect(writeCheckArtifacts(directory, {deterministicFindings, agentChecks})).rejects.toMatchObject({
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
        const externalFindingsPath = joinPath(externalDirectory, 'app-security', 'deterministic-findings.json')
        await mkdir(joinPath(externalDirectory, 'app-security'))
        await writeFile(externalFindingsPath, '{}')
        await symlink(externalDirectory, joinPath(directory, '.shopify'), 'dir')

        await expect(cleanAppSecurityArtifacts(directory)).rejects.toMatchObject({
          constructor: AbortError,
          message: expect.stringMatching(/symbolic link/),
        })
        await expect(fileExists(externalFindingsPath)).resolves.toBe(true)
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

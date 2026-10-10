import {
  appSecurityArtifactPaths,
  appSecurityDirectory,
  cleanAllResultsDirectories,
  cleanResultsDirectory,
  readFindingsDocument,
  resultsDirectoryExists,
  writeAgentFindings,
  writeCheckArtifacts,
} from './app-security-artifacts.js'
import {scanAppDirectory} from './app-security-engine/tests/scan-directory.js'
import {agentFindingsDocument} from './app-security-engine/tests/fixtures/findings-documents.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import {symlink} from 'node:fs/promises'

const RESULTS_KEY = 'shopify.app'

async function scanTestApp(directory: string) {
  await writeFile(joinPath(directory, 'shopify.app.toml'), 'name = "Test"\nclient_id = "test"\n')
  return scanAppDirectory(directory)
}

async function writeEveryArtifact(directory: string, resultsKey: string): Promise<string[]> {
  const paths = appSecurityArtifactPaths(directory, resultsKey)
  const artifactPaths = [paths.deterministicFindingsPath, paths.agentChecksPath, paths.agentFindingsPath]
  await mkdir(paths.resultsDirectory)
  await Promise.all(artifactPaths.map((path) => writeFile(path, '{}')))
  return artifactPaths
}

describe('appSecurityArtifactPaths', () => {
  test('resolves every artifact under the results directory for the results key', () => {
    const resultsDirectory = joinPath('/tmp/example-app', '.shopify', 'app-security', 'shopify.app.production')

    expect(appSecurityArtifactPaths('/tmp/example-app', 'shopify.app.production')).toEqual({
      resultsDirectory,
      deterministicFindingsPath: joinPath(resultsDirectory, 'deterministic-findings.json'),
      agentChecksPath: joinPath(resultsDirectory, 'agent-checks.json'),
      agentFindingsPath: joinPath(resultsDirectory, 'agent-findings.json'),
    })
  })

  test.each(['..', '.', '', '../outside', 'nested/key', 'nested\\key'])(
    'refuses %j as a results key because it is not a single directory name',
    (resultsKey) => {
      expect(() => appSecurityArtifactPaths('/tmp/example-app', resultsKey)).toThrow(AbortError)
    },
  )
})

describe('readFindingsDocument', () => {
  test('returns ok with the deterministic document written by check', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {deterministicFindings, agentChecks} = await scanTestApp(directory)
      const {deterministicFindingsPath} = await writeCheckArtifacts(directory, RESULTS_KEY, {
        deterministicFindings,
        agentChecks,
      })

      await expect(readFindingsDocument(deterministicFindingsPath, 'deterministic')).resolves.toEqual({
        status: 'ok',
        value: deterministicFindings,
      })
    })
  })

  test('returns ok with the agent document written by writeAgentFindings', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = await writeAgentFindings(directory, RESULTS_KEY, agentFindingsDocument)

      expect(path).toBe(appSecurityArtifactPaths(directory, RESULTS_KEY).agentFindingsPath)
      await expect(readFindingsDocument(path, 'agent')).resolves.toEqual({status: 'ok', value: agentFindingsDocument})
    })
  })

  test('narrows the document to the expected source so callers need no further checks', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {deterministicFindings, agentChecks} = await scanTestApp(directory)
      const {deterministicFindingsPath} = await writeCheckArtifacts(directory, RESULTS_KEY, {
        deterministicFindings,
        agentChecks,
      })
      const agentFindingsPath = await writeAgentFindings(directory, RESULTS_KEY, agentFindingsDocument)

      const deterministic = await readFindingsDocument(deterministicFindingsPath, 'deterministic')
      const agent = await readFindingsDocument(agentFindingsPath, 'agent')

      // Source-specific fields compile without narrowing on `source`.
      expect(deterministic.status === 'ok' && deterministic.value.detection).toEqual(deterministicFindings.detection)
      expect(agent.status === 'ok' && agent.value.engine).toEqual(agentFindingsDocument.engine)
    })
  })

  test('returns invalid when the document comes from the other source', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = await writeAgentFindings(directory, RESULTS_KEY, agentFindingsDocument)

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
  test('writes deterministic-findings.json and agent-checks.json under the results key', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {deterministicFindings, agentChecks} = await scanTestApp(directory)
      const paths = appSecurityArtifactPaths(directory, RESULTS_KEY)

      await expect(writeCheckArtifacts(directory, RESULTS_KEY, {deterministicFindings, agentChecks})).resolves.toEqual({
        deterministicFindingsPath: paths.deterministicFindingsPath,
        agentChecksPath: paths.agentChecksPath,
      })

      expect(JSON.parse(await readFile(paths.deterministicFindingsPath))).toEqual(deterministicFindings)
      expect(JSON.parse(await readFile(paths.agentChecksPath))).toEqual(agentChecks)
    })
  })

  test('keeps the results of different results keys apart', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {deterministicFindings, agentChecks} = await scanTestApp(directory)

      await writeCheckArtifacts(directory, 'shopify.app', {deterministicFindings, agentChecks})
      await writeAgentFindings(directory, 'shopify.app.production', agentFindingsDocument)

      await expect(resultsDirectoryExists(directory, 'shopify.app')).resolves.toBe(true)
      await expect(resultsDirectoryExists(directory, 'shopify.app.production')).resolves.toBe(true)
      await expect(fileExists(appSecurityArtifactPaths(directory, 'shopify.app').agentFindingsPath)).resolves.toBe(
        false,
      )
      await expect(
        fileExists(appSecurityArtifactPaths(directory, 'shopify.app.production').deterministicFindingsPath),
      ).resolves.toBe(false)
    })
  })

  test('creates .shopify/.gitignore so the results stay out of version control', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {deterministicFindings, agentChecks} = await scanTestApp(directory)

      await writeCheckArtifacts(directory, RESULTS_KEY, {deterministicFindings, agentChecks})

      await expect(readFile(joinPath(directory, '.shopify', '.gitignore'))).resolves.toContain('*')
    })
  })

  test('overwrites earlier check artifacts and leaves agent-findings.json untouched', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {deterministicFindings, agentChecks} = await scanTestApp(directory)
      const paths = appSecurityArtifactPaths(directory, RESULTS_KEY)
      await mkdir(paths.resultsDirectory)
      await writeFile(paths.deterministicFindingsPath, '{"stale":true}')
      await writeFile(paths.agentChecksPath, '{"stale":true}')
      await writeFile(paths.agentFindingsPath, '{"recorded":"by the agent"}')

      await writeCheckArtifacts(directory, RESULTS_KEY, {deterministicFindings, agentChecks})

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

        await expect(
          writeCheckArtifacts(directory, RESULTS_KEY, {deterministicFindings, agentChecks}),
        ).rejects.toMatchObject({
          constructor: AbortError,
          message: expect.stringMatching(/outside the app/),
        })
        await expect(
          fileExists(joinPath(externalDirectory, 'app-security', RESULTS_KEY, 'deterministic-findings.json')),
        ).resolves.toBe(false)
      })
    })
  })

  test('refuses to write through an app-security symlink', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {deterministicFindings, agentChecks} = await scanTestApp(directory)
      await inTemporaryDirectory(async (externalDirectory) => {
        await mkdir(joinPath(directory, '.shopify'))
        await symlink(externalDirectory, joinPath(directory, '.shopify', 'app-security'), 'dir')

        await expect(
          writeCheckArtifacts(directory, RESULTS_KEY, {deterministicFindings, agentChecks}),
        ).rejects.toMatchObject({
          constructor: AbortError,
          message: expect.stringMatching(/symbolic link/),
        })
        await expect(fileExists(joinPath(externalDirectory, RESULTS_KEY))).resolves.toBe(false)
      })
    })
  })

  test('refuses to write through a results directory symlink', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {deterministicFindings, agentChecks} = await scanTestApp(directory)
      await inTemporaryDirectory(async (externalDirectory) => {
        await mkdir(appSecurityDirectory(directory))
        await symlink(externalDirectory, appSecurityArtifactPaths(directory, RESULTS_KEY).resultsDirectory, 'dir')

        await expect(
          writeCheckArtifacts(directory, RESULTS_KEY, {deterministicFindings, agentChecks}),
        ).rejects.toMatchObject({
          constructor: AbortError,
          message: expect.stringMatching(/symbolic link/),
        })
        await expect(fileExists(joinPath(externalDirectory, 'deterministic-findings.json'))).resolves.toBe(false)
      })
    })
  })
})

describe('writeAgentFindings', () => {
  test('refuses to write through a results directory symlink', async () => {
    await inTemporaryDirectory(async (directory) => {
      await inTemporaryDirectory(async (externalDirectory) => {
        await mkdir(appSecurityDirectory(directory))
        await symlink(externalDirectory, appSecurityArtifactPaths(directory, RESULTS_KEY).resultsDirectory, 'dir')

        await expect(writeAgentFindings(directory, RESULTS_KEY, agentFindingsDocument)).rejects.toMatchObject({
          constructor: AbortError,
          message: expect.stringMatching(/symbolic link/),
        })
        await expect(fileExists(joinPath(externalDirectory, 'agent-findings.json'))).resolves.toBe(false)
      })
    })
  })
})

describe('resultsDirectoryExists', () => {
  test('is true only for a results key that has a results directory', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeEveryArtifact(directory, 'shopify.app')

      await expect(resultsDirectoryExists(directory, 'shopify.app')).resolves.toBe(true)
      await expect(resultsDirectoryExists(directory, 'shopify.app.production')).resolves.toBe(false)
    })
  })

  test('is false when .shopify does not exist', async () => {
    await inTemporaryDirectory(async (directory) => {
      await expect(resultsDirectoryExists(directory, RESULTS_KEY)).resolves.toBe(false)
    })
  })

  test('refuses a results directory that is a symlink', async () => {
    await inTemporaryDirectory(async (directory) => {
      await inTemporaryDirectory(async (externalDirectory) => {
        await mkdir(appSecurityDirectory(directory))
        await symlink(externalDirectory, appSecurityArtifactPaths(directory, RESULTS_KEY).resultsDirectory, 'dir')

        await expect(resultsDirectoryExists(directory, RESULTS_KEY)).rejects.toMatchObject({
          constructor: AbortError,
          message: expect.stringMatching(/symbolic link/),
        })
      })
    })
  })
})

describe('cleanResultsDirectory', () => {
  test('removes only the results directory for the key, including files it holds, and returns its path', async () => {
    await inTemporaryDirectory(async (directory) => {
      const keptPaths = await writeEveryArtifact(directory, 'shopify.app.production')
      const artifactPaths = await writeEveryArtifact(directory, RESULTS_KEY)
      const {resultsDirectory} = appSecurityArtifactPaths(directory, RESULTS_KEY)
      await writeFile(joinPath(resultsDirectory, 'notes.txt'), 'removed too')

      await expect(cleanResultsDirectory(directory, RESULTS_KEY)).resolves.toEqual([resultsDirectory])

      await expect(fileExists(resultsDirectory)).resolves.toBe(false)
      await expect(Promise.all(artifactPaths.map(fileExists))).resolves.toEqual(artifactPaths.map(() => false))
      await expect(Promise.all(keptPaths.map(fileExists))).resolves.toEqual(keptPaths.map(() => true))
    })
  })

  test('returns an empty list without creating anything when the results directory does not exist', async () => {
    await inTemporaryDirectory(async (directory) => {
      await expect(cleanResultsDirectory(directory, RESULTS_KEY)).resolves.toEqual([])
      await expect(fileExists(joinPath(directory, '.shopify'))).resolves.toBe(false)
    })
  })

  test('refuses a .shopify symlink and leaves its target alone', async () => {
    await inTemporaryDirectory(async (directory) => {
      await inTemporaryDirectory(async (externalDirectory) => {
        const externalFindingsPath = joinPath(externalDirectory, 'app-security', RESULTS_KEY, 'agent-findings.json')
        await mkdir(joinPath(externalDirectory, 'app-security', RESULTS_KEY))
        await writeFile(externalFindingsPath, '{}')
        await symlink(externalDirectory, joinPath(directory, '.shopify'), 'dir')

        await expect(cleanResultsDirectory(directory, RESULTS_KEY)).rejects.toMatchObject({
          constructor: AbortError,
          message: expect.stringMatching(/symbolic link/),
        })
        await expect(fileExists(externalFindingsPath)).resolves.toBe(true)
      })
    })
  })

  test('refuses a results directory that is a symlink and leaves its target alone', async () => {
    await inTemporaryDirectory(async (directory) => {
      await inTemporaryDirectory(async (externalDirectory) => {
        const targetPath = joinPath(externalDirectory, 'agent-findings.json')
        await writeFile(targetPath, 'keep')
        await mkdir(appSecurityDirectory(directory))
        await symlink(externalDirectory, appSecurityArtifactPaths(directory, RESULTS_KEY).resultsDirectory, 'dir')

        await expect(cleanResultsDirectory(directory, RESULTS_KEY)).rejects.toMatchObject({
          constructor: AbortError,
          message: expect.stringMatching(/symbolic link/),
        })
        await expect(readFile(targetPath)).resolves.toBe('keep')
      })
    })
  })

  test('removes a symlink inside the results directory without deleting its target', async () => {
    await inTemporaryDirectory(async (directory) => {
      await inTemporaryDirectory(async (externalDirectory) => {
        const paths = appSecurityArtifactPaths(directory, RESULTS_KEY)
        const targetPath = joinPath(externalDirectory, 'deterministic-findings.json')
        await writeFile(targetPath, 'keep')
        await mkdir(paths.resultsDirectory)
        await symlink(targetPath, paths.deterministicFindingsPath, 'file')

        await expect(cleanResultsDirectory(directory, RESULTS_KEY)).resolves.toEqual([paths.resultsDirectory])
        await expect(readFile(targetPath)).resolves.toBe('keep')
      })
    })
  })
})

describe('cleanAllResultsDirectories', () => {
  test('removes every results directory, leaves files directly in app-security, and returns the removed paths', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeEveryArtifact(directory, 'shopify.app')
      await writeEveryArtifact(directory, '1234567890abcdef')
      const strayFilePath = joinPath(appSecurityDirectory(directory), 'notes.txt')
      await writeFile(strayFilePath, 'keep')

      const removed = await cleanAllResultsDirectories(directory)

      expect([...removed].sort()).toEqual(
        [
          appSecurityArtifactPaths(directory, '1234567890abcdef').resultsDirectory,
          appSecurityArtifactPaths(directory, 'shopify.app').resultsDirectory,
        ].sort(),
      )
      await expect(resultsDirectoryExists(directory, 'shopify.app')).resolves.toBe(false)
      await expect(resultsDirectoryExists(directory, '1234567890abcdef')).resolves.toBe(false)
      await expect(readFile(strayFilePath)).resolves.toBe('keep')
    })
  })

  test('returns an empty list without creating anything when app-security does not exist', async () => {
    await inTemporaryDirectory(async (directory) => {
      await expect(cleanAllResultsDirectories(directory)).resolves.toEqual([])
      await expect(fileExists(joinPath(directory, '.shopify'))).resolves.toBe(false)
    })
  })

  test('refuses a .shopify symlink and leaves its target alone', async () => {
    await inTemporaryDirectory(async (directory) => {
      await inTemporaryDirectory(async (externalDirectory) => {
        const externalFindingsPath = joinPath(externalDirectory, 'app-security', RESULTS_KEY, 'agent-findings.json')
        await mkdir(joinPath(externalDirectory, 'app-security', RESULTS_KEY))
        await writeFile(externalFindingsPath, '{}')
        await symlink(externalDirectory, joinPath(directory, '.shopify'), 'dir')

        await expect(cleanAllResultsDirectories(directory)).rejects.toMatchObject({
          constructor: AbortError,
          message: expect.stringMatching(/symbolic link/),
        })
        await expect(fileExists(externalFindingsPath)).resolves.toBe(true)
      })
    })
  })

  test('removes nothing when a results directory is a symlink', async () => {
    await inTemporaryDirectory(async (directory) => {
      await inTemporaryDirectory(async (externalDirectory) => {
        await writeEveryArtifact(directory, 'shopify.app')
        const targetPath = joinPath(externalDirectory, 'agent-findings.json')
        await writeFile(targetPath, 'keep')
        await symlink(externalDirectory, appSecurityArtifactPaths(directory, 'linked').resultsDirectory, 'dir')

        await expect(cleanAllResultsDirectories(directory)).rejects.toMatchObject({
          constructor: AbortError,
          message: expect.stringMatching(/symbolic link/),
        })
        await expect(fileExists(appSecurityArtifactPaths(directory, 'shopify.app').agentFindingsPath)).resolves.toBe(
          true,
        )
        await expect(readFile(targetPath)).resolves.toBe('keep')
      })
    })
  })
})

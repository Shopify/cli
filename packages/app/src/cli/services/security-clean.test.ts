import securityClean, {renderSecurityCleanResult} from './security-clean.js'
import {securityCleanJsonOutputSchema} from './security-clean-json.js'
import {resolveAppSecurityRoot} from './app-security-api.js'
import {appSecurityArtifactPaths, cleanAppSecurityArtifacts} from './app-security-artifacts.js'
import {fileExists, inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {joinPath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test, vi} from 'vitest'
import {symlink} from 'node:fs/promises'
import type {SecurityCleanDependencies} from './security-clean.js'
import type {AppSecurityArtifactPaths} from './app-security-artifacts.js'

async function createApp(directory: string): Promise<string> {
  await writeFile(joinPath(directory, 'shopify.app.toml'), 'client_id = "test"\n')
  return resolveAppSecurityRoot(directory)
}

async function writeEveryArtifact(paths: AppSecurityArtifactPaths): Promise<string[]> {
  const artifacts = [
    paths.deterministicFindingsPath,
    paths.agentChecksPath,
    paths.agentFindingsPath,
    paths.submissionPath,
    ...paths.legacyPaths,
  ]
  await mkdir(paths.artifactDirectory)
  await Promise.all(artifacts.map((path) => writeFile(path, '{}\n')))
  return artifacts
}

function testDependencies(): SecurityCleanDependencies {
  return {cleanArtifacts: vi.fn(cleanAppSecurityArtifacts)}
}

describe('securityClean', () => {
  test('removes every current and legacy artifact, returns the removed paths, and prints nothing', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const artifacts = await writeEveryArtifact(appSecurityArtifactPaths(appRoot))
      const dependencies = testDependencies()
      const output = mockAndCaptureOutput()
      output.clear()

      const result = await securityClean({appRoot}, dependencies)

      expect(result).toStrictEqual({removed: artifacts})
      await expect(Promise.all(artifacts.map(fileExists))).resolves.toEqual(artifacts.map(() => false))
      expect(dependencies.cleanArtifacts).toHaveBeenCalledWith(appRoot)
      expect(output.info()).toBe('')
      expect(output.success()).toBe('')
      expect(output.warn()).toBe('')
      expect(output.error()).toBe('')
      output.clear()
    })
  })

  test('returns an empty list when there is nothing to remove', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const dependencies = testDependencies()

      const result = await securityClean({appRoot}, dependencies)

      expect(result).toStrictEqual({removed: []})
    })
  })

  test('propagates the symlink guard error from cleanAppSecurityArtifacts', async () => {
    await inTemporaryDirectory(async (directory) => {
      await inTemporaryDirectory(async (externalDirectory) => {
        const appRoot = await createApp(directory)
        await symlink(externalDirectory, joinPath(appRoot, '.shopify'), 'dir')

        await expect(securityClean({appRoot})).rejects.toMatchObject({
          constructor: AbortError,
          message: expect.stringMatching(/symbolic link/),
        })
      })
    })
  })
})

describe('securityCleanJsonOutputSchema', () => {
  test('encodes exactly the removed paths', () => {
    const encoded = securityCleanJsonOutputSchema.encode({removed: ['a.json', 'b.json']})

    expect(encoded).toBe(['{', '  "removed": [', '    "a.json",', '    "b.json"', '  ]', '}'].join('\n'))
  })

  test('encodes an empty list', () => {
    const encoded = securityCleanJsonOutputSchema.encode({removed: []})

    expect(encoded).toBe(['{', '  "removed": []', '}'].join('\n'))
  })

  test('validates a well-formed result and rejects a malformed one', () => {
    const result = {removed: ['a.json']}
    expect(securityCleanJsonOutputSchema.validate(result)).toStrictEqual(result)
    expect(() => securityCleanJsonOutputSchema.validate({removed: 'a.json'})).toThrow()
  })
})

describe('renderSecurityCleanResult', () => {
  test('lists every removed path', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const artifacts = await writeEveryArtifact(appSecurityArtifactPaths(appRoot))
      const output = mockAndCaptureOutput()
      output.clear()

      renderSecurityCleanResult({removed: artifacts}, appRoot)

      const rendered = output.info()
      expect(rendered).toContain('App Security artifacts removed.')
      expect(rendered).toContain('deterministic-findings.json')
      expect(rendered).toContain('agent-checks.json')
      expect(rendered).toContain('agent-findings.json')
      expect(rendered).toContain('submission.json')
      output.clear()
    })
  })

  test('notes that there was nothing to remove', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const output = mockAndCaptureOutput()
      output.clear()

      renderSecurityCleanResult({removed: []}, appRoot)

      const rendered = output.info()
      expect(rendered).toContain('No App Security artifacts to remove.')
      expect(rendered).toContain('app-security')
      output.clear()
    })
  })
})

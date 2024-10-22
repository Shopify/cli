import cleanup from './cleanup.js'
import {describe, expect, test} from 'vitest'
import {inTemporaryDirectory, mkdir, writeFile, fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

describe('cleanup', () => {
  async function mockProjectFolder(tmpDir: string) {
    // Given
    await Promise.all([
      // should keep these
      writeFile(joinPath(tmpDir, 'server.js'), 'console.log()'),
      writeFile(joinPath(tmpDir, 'cli-liquid-bypass'), '*'),
      mkdir(joinPath(tmpDir, 'node_modules')),

      // should delete these
      mkdir(joinPath(tmpDir, '.git')),
      mkdir(joinPath(tmpDir, '.github')),
      mkdir(joinPath(tmpDir, '.gitmodules')),
      mkdir(joinPath(tmpDir, 'frontend')),
      mkdir(joinPath(tmpDir, 'package.json.cli2')),
    ])

    await Promise.all([
      // should keep these
      writeFile(joinPath(tmpDir, 'frontend', 'server.js'), 'console.log()'),

      // should delete these
      mkdir(joinPath(tmpDir, 'frontend', '.git')),
      mkdir(joinPath(tmpDir, 'frontend', 'node_modules')),
    ])
  }

  test('cleans up template files in web directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      await mockProjectFolder(tmpDir)

      // When
      await cleanup(tmpDir)

      // Then
      await expect(fileExists(joinPath(tmpDir, '.git'))).resolves.toBe(false)
      await expect(fileExists(joinPath(tmpDir, '.github'))).resolves.toBe(false)
      await expect(fileExists(joinPath(tmpDir, '.gitmodules'))).resolves.toBe(false)
      await expect(fileExists(joinPath(tmpDir, '.cli-liquid-bypass'))).resolves.toBe(false)
      await expect(fileExists(joinPath(tmpDir, 'frontend', '.git'))).resolves.toBe(false)
      await expect(fileExists(joinPath(tmpDir, 'package.json.cli2'))).resolves.toBe(false)
    })
  })

  test('keeps non-template files', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      await mockProjectFolder(tmpDir)

      // When
      await cleanup(tmpDir)

      // Then
      await expect(fileExists(joinPath(tmpDir, 'server.js'))).resolves.toBe(true)
      await expect(fileExists(joinPath(tmpDir, 'node_modules'))).resolves.toBe(true)
      await expect(fileExists(joinPath(tmpDir, 'frontend', 'node_modules'))).resolves.toBe(true)
    })
  })
})

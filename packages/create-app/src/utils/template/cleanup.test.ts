import cleanup from './cleanup.js'
import {path} from '@shopify/cli-kit'
import {describe, expect, it} from 'vitest'
import {inTemporaryDirectory, mkdir, writeFile, fileExists} from '@shopify/cli-kit/node/file'

describe('cleanup', () => {
  async function mockProjectFolder(tmpDir: string) {
    // Given
    await Promise.all([
      // should keep these
      writeFile(path.join(tmpDir, 'server.js'), 'console.log()'),
      mkdir(path.join(tmpDir, 'node_modules')),

      // should delete these
      mkdir(path.join(tmpDir, '.git')),
      mkdir(path.join(tmpDir, '.github')),
      mkdir(path.join(tmpDir, '.gitmodules')),
      mkdir(path.join(tmpDir, 'frontend')),
      mkdir(path.join(tmpDir, 'package.json.cli2')),
    ])

    await Promise.all([
      // should keep these
      writeFile(path.join(tmpDir, 'frontend', 'server.js'), 'console.log()'),

      // should delete these
      mkdir(path.join(tmpDir, 'frontend', '.git')),
      mkdir(path.join(tmpDir, 'frontend', 'node_modules')),
    ])
  }

  it('cleans up template files in web directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      await mockProjectFolder(tmpDir)

      // When
      await cleanup(tmpDir)

      // Then
      await expect(fileExists(path.join(tmpDir, '.git'))).resolves.toBe(false)
      await expect(fileExists(path.join(tmpDir, '.github'))).resolves.toBe(false)
      await expect(fileExists(path.join(tmpDir, '.gitmodules'))).resolves.toBe(false)
      await expect(fileExists(path.join(tmpDir, 'frontend', '.git'))).resolves.toBe(false)
      await expect(fileExists(path.join(tmpDir, 'package.json.cli2'))).resolves.toBe(false)
    })
  })

  it('keeps non-template files', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      await mockProjectFolder(tmpDir)

      // When
      await cleanup(tmpDir)

      // Then
      await expect(fileExists(path.join(tmpDir, 'server.js'))).resolves.toBe(true)
      await expect(fileExists(path.join(tmpDir, 'node_modules'))).resolves.toBe(true)
      await expect(fileExists(path.join(tmpDir, 'frontend', 'node_modules'))).resolves.toBe(true)
    })
  })
})

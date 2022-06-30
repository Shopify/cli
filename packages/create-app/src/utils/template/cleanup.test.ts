import cleanup from './cleanup'
import {file, path} from '@shopify/cli-kit'
import {describe, expect, it} from 'vitest'

describe('cleanup', () => {
  async function mockProjectFolder(tmpDir: string) {
    // Given
    await Promise.all([
      // should keep these
      file.write(path.join(tmpDir, 'server.js'), 'console.log()'),
      file.mkdir(path.join(tmpDir, 'node_modules')),

      // should delete these
      file.mkdir(path.join(tmpDir, '.git')),
      file.mkdir(path.join(tmpDir, '.github')),
      file.mkdir(path.join(tmpDir, '.gitmodules')),
      file.mkdir(path.join(tmpDir, 'frontend')),
      file.mkdir(path.join(tmpDir, 'package.json.cli2')),
    ])

    await Promise.all([
      // should keep these
      file.write(path.join(tmpDir, 'frontend', 'server.js'), 'console.log()'),

      // should delete these
      file.mkdir(path.join(tmpDir, 'frontend', '.git')),
      file.mkdir(path.join(tmpDir, 'frontend', 'node_modules')),
    ])
  }

  it('cleans up template files in web directory', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      await mockProjectFolder(tmpDir)

      // When
      await cleanup(tmpDir)

      // Then
      await expect(file.exists(path.join(tmpDir, '.git'))).resolves.toBe(false)
      await expect(file.exists(path.join(tmpDir, '.github'))).resolves.toBe(false)
      await expect(file.exists(path.join(tmpDir, '.gitmodules'))).resolves.toBe(false)
      await expect(file.exists(path.join(tmpDir, 'frontend', '.git'))).resolves.toBe(false)
      await expect(file.exists(path.join(tmpDir, 'package.json.cli2'))).resolves.toBe(false)
    })
  })

  it('keeps non-template files', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      await mockProjectFolder(tmpDir)

      // When
      await cleanup(tmpDir)

      // Then
      await expect(file.exists(path.join(tmpDir, 'server.js'))).resolves.toBe(true)
      await expect(file.exists(path.join(tmpDir, 'node_modules'))).resolves.toBe(true)
      await expect(file.exists(path.join(tmpDir, 'frontend', 'node_modules'))).resolves.toBe(true)
    })
  })
})

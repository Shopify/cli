import {temporary} from '@shopify/cli-testing'
import {file, path} from '@shopify/cli-kit'
import {describe, expect, it} from 'vitest'
import {configurationFileNames} from '../../constants'
import cleanup from './cleanup'

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
      file.mkdir(path.join(tmpDir, '_template')),
      file.mkdir(path.join(tmpDir, 'frontend')),
      file.write(path.join(tmpDir, configurationFileNames.homeTemplate), 'content'),
    ])

    await Promise.all([
      // should keep these
      file.write(path.join(tmpDir, 'frontend', 'server.js'), 'console.log()'),

      // should delete these
      file.mkdir(path.join(tmpDir, 'frontend', '.git')),
      file.mkdir(path.join(tmpDir, 'frontend', '_template')),
      file.mkdir(path.join(tmpDir, 'frontend', 'node_modules')),
    ])
  }

  it('cleans up template files in home directory', async () => {
    await temporary.directory(async (tmpDir) => {
      await mockProjectFolder(tmpDir)

      // When
      await cleanup(tmpDir)

      // Then

      expect(await file.exists(path.join(tmpDir, '.git'))).toBe(false)
      expect(await file.exists(path.join(tmpDir, '.github'))).toBe(false)
      expect(await file.exists(path.join(tmpDir, '.gitmodules'))).toBe(false)
      expect(await file.exists(path.join(tmpDir, '_template'))).toBe(false)
      expect(await file.exists(path.join(tmpDir, 'frontend', '.git'))).toBe(false)
      expect(await file.exists(path.join(tmpDir, 'frontend', '_template'))).toBe(false)
      expect(await file.exists(path.join(tmpDir, configurationFileNames.homeTemplate))).toBe(false)
    })
  })

  it('keeps non-template files', async () => {
    await temporary.directory(async (tmpDir) => {
      await mockProjectFolder(tmpDir)

      // When
      await cleanup(tmpDir)

      // Then
      expect(await file.exists(path.join(tmpDir, 'server.js'))).toBe(true)
      expect(await file.exists(path.join(tmpDir, 'node_modules'))).toBe(true)
      expect(await file.exists(path.join(tmpDir, 'frontend', 'node_modules'))).toBe(true)
    })
  })
})

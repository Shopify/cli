import {build} from './build.js'
import {describe, it, expect, vi} from 'vitest'
import {build as viteBuild} from 'vite'
import {file} from '@shopify/cli-kit'

vi.mock('vite')

describe('build', () => {
  it('runs vite build with logLevel as "silent" by default', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const options = {
        directory: tmpDir,
        targets: {client: false, worker: 'path/to/target', node: false},
      }

      // When
      await build(options)

      // Then
      await expect(viteBuild).toHaveBeenCalledWith(expect.objectContaining({logLevel: 'silent'}))
    })
  })

  it('runs vite build with logLevel as "info" when verbose flag is passed', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const options = {
        verbose: true,
        directory: tmpDir,
        targets: {client: false, worker: 'path/to/target', node: false},
      }

      // When
      await build(options)

      // Then
      await expect(viteBuild).toHaveBeenCalledWith(expect.objectContaining({logLevel: 'info'}))
    })
  })
})

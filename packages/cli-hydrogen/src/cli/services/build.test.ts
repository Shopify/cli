import {build} from './build.js'
import {checkLockfileStatus} from './build/check-lockfile.js'
import {describe, it, expect, vi} from 'vitest'
import {build as viteBuild} from 'vite'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'

vi.mock('vite')
vi.mock('./build/check-lockfile.js', () => {
  return {
    checkLockfileStatus: vi.fn(),
  }
})

describe('build', () => {
  it('runs vite build with logLevel as "silent" by default', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
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
    await inTemporaryDirectory(async (tmpDir) => {
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

  it('checks for a missing lockfile', async () => {
    const options = {
      directory: 'dir',
      targets: {client: false, worker: 'path/to/target', node: false},
    }

    await build(options)

    expect(checkLockfileStatus).toHaveBeenCalledOnce()
    expect(checkLockfileStatus).toHaveBeenCalledWith('dir')
  })
})

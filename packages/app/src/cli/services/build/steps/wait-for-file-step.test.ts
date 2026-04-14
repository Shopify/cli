import {executeWaitForFileStep, WaitForFileStep} from './wait-for-file-step.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {ExtensionBuildOptions} from '../extension.js'
import {inTemporaryDirectory, mkdir, touchFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import {Writable} from 'stream'

function createMockContext(directory: string, staticRoot?: string) {
  const stdout = new Writable({
    write(_chunk, _encoding, callback) {
      callback()
    },
  })

  return {
    extension: {
      directory,
      configuration: {
        name: 'test-admin',
        type: 'admin',
        admin: staticRoot ? {static_root: staticRoot} : undefined,
      },
    } as unknown as ExtensionInstance,
    options: {
      stdout,
      stderr: stdout,
    } as unknown as ExtensionBuildOptions,
    stepResults: new Map(),
  }
}

function createWaitStep(overrides: Partial<WaitForFileStep['config']> = {}): WaitForFileStep {
  return {
    id: 'test-wait',
    name: 'Test Wait Step',
    type: 'wait_for_file',
    config: {
      configKey: 'admin.static_root',
      filename: 'index.html',
      timeoutMs: 1000,
      intervalMs: 100,
      ...overrides,
    },
  }
}

describe('wait-for-file-step', () => {
  test('succeeds immediately when config key is not set', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const context = createMockContext(tmpDir, undefined)
      const step = createWaitStep()

      const result = await executeWaitForFileStep(step, context)

      expect(result.waited).toBe(false)
      expect(result.filePath).toBeUndefined()
    })
  })

  test('succeeds immediately when file already exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const distDir = joinPath(tmpDir, 'dist')
      await mkdir(distDir)
      await touchFile(joinPath(distDir, 'index.html'))

      const context = createMockContext(tmpDir, './dist')
      const step = createWaitStep()

      const result = await executeWaitForFileStep(step, context)

      expect(result.waited).toBe(false)
      expect(result.filePath).toContain('index.html')
    })
  })

  test('waits for file to appear and succeeds', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const distDir = joinPath(tmpDir, 'dist')
      await mkdir(distDir)

      const context = createMockContext(tmpDir, './dist')
      const step = createWaitStep({timeoutMs: 2000, intervalMs: 50})

      // Create the file after a short delay
      setTimeout(() => {
        touchFile(joinPath(distDir, 'index.html')).catch(() => {})
      }, 200)

      const result = await executeWaitForFileStep(step, context)

      expect(result.waited).toBe(true)
      expect(result.filePath).toContain('index.html')
    })
  })

  test('times out when file does not appear', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const distDir = joinPath(tmpDir, 'dist')
      await mkdir(distDir)

      const context = createMockContext(tmpDir, './dist')
      const step = createWaitStep({timeoutMs: 500, intervalMs: 100})

      await expect(executeWaitForFileStep(step, context)).rejects.toThrow(
        "Timed out waiting for 'index.html' in './dist'",
      )
    })
  })

  test('uses custom filename from config', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const distDir = joinPath(tmpDir, 'dist')
      await mkdir(distDir)
      await touchFile(joinPath(distDir, 'custom.html'))

      const context = createMockContext(tmpDir, './dist')
      const step = createWaitStep({filename: 'custom.html'})

      const result = await executeWaitForFileStep(step, context)

      expect(result.waited).toBe(false)
      expect(result.filePath).toContain('custom.html')
    })
  })
})

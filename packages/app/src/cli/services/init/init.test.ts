import {ensurePnpmWorkspaceFile} from './init.js'
import {describe, expect, test} from 'vitest'
import {inTemporaryDirectory, writeFile, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

describe('ensurePnpmWorkspaceFile', () => {
  test('generates file when template has none', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      await ensurePnpmWorkspaceFile(tmpDir, ['extensions/*'])

      const content = await readFile(joinPath(tmpDir, 'pnpm-workspace.yaml'))
      expect(content).toBe("packages:\n - 'extensions/*'")
    })
  })

  test('does not overwrite existing file from template', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const templateContent = `packages:\n  - 'extensions/*'\nallowBuilds:\n  esbuild: true\n`
      await writeFile(joinPath(tmpDir, 'pnpm-workspace.yaml'), templateContent)

      await ensurePnpmWorkspaceFile(tmpDir, ['extensions/*'])

      const content = await readFile(joinPath(tmpDir, 'pnpm-workspace.yaml'))
      expect(content).toBe(templateContent)
    })
  })
})

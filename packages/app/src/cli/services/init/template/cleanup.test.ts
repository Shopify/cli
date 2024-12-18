import cleanup from './cleanup.js'
import {describe, expect, test} from 'vitest'
import {inTemporaryDirectory, mkdir, writeFile, fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {PackageManager} from '@shopify/cli-kit/node/node-package-manager'

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
      await cleanup(tmpDir, 'npm')

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
      await cleanup(tmpDir, 'npm')

      // Then
      await expect(fileExists(joinPath(tmpDir, 'server.js'))).resolves.toBe(true)
      await expect(fileExists(joinPath(tmpDir, 'node_modules'))).resolves.toBe(true)
      await expect(fileExists(joinPath(tmpDir, 'frontend', 'node_modules'))).resolves.toBe(true)
    })
  })

  test.each(['npm', 'yarn', 'pnpm', 'bun'])('deletes unused lockfiles for %s', async (packageManager) => {
    await inTemporaryDirectory(async (tmpDir) => {
      await mockProjectFolder(tmpDir)
      await writeFile(joinPath(tmpDir, 'package-lock.json'), '{}')
      await writeFile(joinPath(tmpDir, 'yarn.lock'), '{}')
      await writeFile(joinPath(tmpDir, 'pnpm-lock.yaml'), '{}')
      await writeFile(joinPath(tmpDir, 'bun.lockb'), '{}')

      // When
      await cleanup(tmpDir, packageManager as PackageManager)

      // Then
      await expect(fileExists(joinPath(tmpDir, 'package-lock.json'))).resolves.toBe(packageManager === 'npm')
      await expect(fileExists(joinPath(tmpDir, 'yarn.lock'))).resolves.toBe(packageManager === 'yarn')
      await expect(fileExists(joinPath(tmpDir, 'pnpm-lock.yaml'))).resolves.toBe(packageManager === 'pnpm')
      await expect(fileExists(joinPath(tmpDir, 'bun.lockb'))).resolves.toBe(packageManager === 'bun')
    })
  })

  test('deletes all lockfiles for unknown package manager', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      await mockProjectFolder(tmpDir)
      await writeFile(joinPath(tmpDir, 'package-lock.json'), '{}')
      await writeFile(joinPath(tmpDir, 'yarn.lock'), '{}')
      await writeFile(joinPath(tmpDir, 'pnpm-lock.yaml'), '{}')
      await writeFile(joinPath(tmpDir, 'bun.lockb'), '{}')

      // When
      await cleanup(tmpDir, 'unknown')

      // Then
      await expect(fileExists(joinPath(tmpDir, 'package-lock.json'))).resolves.toBe(false)
      await expect(fileExists(joinPath(tmpDir, 'yarn.lock'))).resolves.toBe(false)
      await expect(fileExists(joinPath(tmpDir, 'pnpm-lock.yaml'))).resolves.toBe(false)
      await expect(fileExists(joinPath(tmpDir, 'bun.lockb'))).resolves.toBe(false)
    })
  })
})

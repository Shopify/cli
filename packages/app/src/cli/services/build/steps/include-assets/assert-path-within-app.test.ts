import {assertPathWithinAppDir} from './assert-path-within-app.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import {symlink} from 'fs/promises'

describe('assertPathWithinAppDir', () => {
  test('allows a path inside the app directory', async () => {
    await inTemporaryDirectory(async (appDir) => {
      const inside = joinPath(appDir, 'extensions', 'ext-a')
      await mkdir(inside)
      await writeFile(joinPath(inside, 'icon.png'), 'x')
      await expect(
        assertPathWithinAppDir(joinPath(inside, 'icon.png'), appDir, 'extensions/ext-a/icon.png'),
      ).resolves.toBeUndefined()
    })
  })

  test('allows the app directory itself', async () => {
    await inTemporaryDirectory(async (appDir) => {
      await expect(assertPathWithinAppDir(appDir, appDir, '.')).resolves.toBeUndefined()
    })
  })

  test('rejects a path that resolves outside the app directory via ..', async () => {
    await inTemporaryDirectory(async (parent) => {
      const appDir = joinPath(parent, 'app')
      await mkdir(appDir)
      const outside = joinPath(parent, 'outside.json')
      await writeFile(outside, '{}')
      await expect(assertPathWithinAppDir(outside, appDir, '../outside.json')).rejects.toThrow(AbortError)
      await expect(assertPathWithinAppDir(outside, appDir, '../outside.json')).rejects.toThrow(
        /resolves outside the app directory/,
      )
    })
  })

  test('rejects a symlink whose target is outside the app directory', async () => {
    await inTemporaryDirectory(async (parent) => {
      const appDir = joinPath(parent, 'app')
      await mkdir(appDir)
      const outsideDir = joinPath(parent, 'home', 'big-folder')
      await mkdir(outsideDir)
      await writeFile(joinPath(outsideDir, 'huge.bin'), 'x')

      // Inside the app dir, but the symlink points outside.
      const symlinkInApp = joinPath(appDir, 'assets')
      await symlink(outsideDir, symlinkInApp)

      await expect(assertPathWithinAppDir(symlinkInApp, appDir, 'assets')).rejects.toThrow(AbortError)
    })
  })

  test('allows an in-tree symlink (e.g. pnpm-style links staying inside the app)', async () => {
    await inTemporaryDirectory(async (appDir) => {
      const realTarget = joinPath(appDir, 'shared')
      await mkdir(realTarget)
      const linkPath = joinPath(appDir, 'extensions', 'ext-a-assets')
      await mkdir(joinPath(appDir, 'extensions'))
      await symlink(realTarget, linkPath)

      await expect(assertPathWithinAppDir(linkPath, appDir, 'extensions/ext-a-assets')).resolves.toBeUndefined()
    })
  })

  test('does not false-positive on macOS-style symlinked temp dirs (both sides realpath’d)', async () => {
    // inTemporaryDirectory on macOS returns a /var/folders/... path whose
    // realpath is /private/var/folders/.... If only the source were realpath’d
    // the check would treat the temp dir as outside itself.
    await inTemporaryDirectory(async (appDir) => {
      const inside = joinPath(appDir, 'src')
      await mkdir(inside)
      await writeFile(joinPath(inside, 'schema.json'), '{}')
      await expect(
        assertPathWithinAppDir(joinPath(inside, 'schema.json'), appDir, 'src/schema.json'),
      ).resolves.toBeUndefined()
    })
  })

  test('allows a sibling whose name starts with two dots (e.g. ..cache)', async () => {
    await inTemporaryDirectory(async (appDir) => {
      const dotdotDir = joinPath(appDir, '..cache')
      await mkdir(dotdotDir)
      await writeFile(joinPath(dotdotDir, 'file.txt'), 'x')
      await expect(
        assertPathWithinAppDir(joinPath(dotdotDir, 'file.txt'), appDir, '..cache/file.txt'),
      ).resolves.toBeUndefined()
    })
  })

  test('includes the original config value in the error for debuggability', async () => {
    await inTemporaryDirectory(async (parent) => {
      const appDir = joinPath(parent, 'app')
      await mkdir(appDir)
      const outside = joinPath(parent, 'leak')
      await writeFile(outside, '')
      await expect(assertPathWithinAppDir(outside, appDir, '~/anywhere')).rejects.toThrow(/Asset path '~\/anywhere'/)
    })
  })
})

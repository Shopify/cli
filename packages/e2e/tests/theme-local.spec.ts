/* eslint-disable no-restricted-imports */
import {cliFixture as test} from '../setup/cli.js'
import {expect} from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import {fileURLToPath} from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DAWN_MINIMAL_DIR = path.join(__dirname, '../data/dawn-minimal')

test.describe('Theme local commands', () => {
  test('theme init creates a new theme from Dawn', async ({cli, env}) => {
    const initDir = fs.mkdtempSync(path.join(env.tempDir, 'theme-init-'))
    const themeName = 'e2e-test-init'

    const result = await cli.exec(['theme', 'init', themeName, '--path', initDir], {timeout: 2 * 60 * 1000})

    expect(result.exitCode).toBe(0)
    // Theme is created in a subdirectory with the theme name
    const themeDir = path.join(initDir, themeName)
    expect(fs.existsSync(path.join(themeDir, 'layout', 'theme.liquid'))).toBe(true)
    expect(fs.existsSync(path.join(themeDir, 'config', 'settings_schema.json'))).toBe(true)

    // Cleanup
    fs.rmSync(initDir, {recursive: true, force: true})
  })

  test('theme check validates theme files', async ({cli, env}) => {
    // Copy dawn-minimal to temp dir for checking
    const checkDir = fs.mkdtempSync(path.join(env.tempDir, 'theme-check-'))
    copyDirRecursive(DAWN_MINIMAL_DIR, checkDir)

    const result = await cli.exec(['theme', 'check', '--path', checkDir], {timeout: 60 * 1000})

    // theme check exits 0 if no errors (warnings are OK)
    // Exit code 1 means there are errors
    expect(result.exitCode).toBeLessThanOrEqual(1)
    // Verify it actually ran - output should mention checking
    expect(result.stdout + result.stderr).toMatch(/check|valid|error|warning/i)

    // Cleanup
    fs.rmSync(checkDir, {recursive: true, force: true})
  })

  test('theme package creates a zip file', async ({cli, env}) => {
    // Copy dawn-minimal to temp dir for packaging
    const packageDir = fs.mkdtempSync(path.join(env.tempDir, 'theme-package-'))
    copyDirRecursive(DAWN_MINIMAL_DIR, packageDir)

    const result = await cli.exec(['theme', 'package', '--path', packageDir], {timeout: 60 * 1000})

    expect(result.exitCode).toBe(0)

    // Verify zip file was created - look for .zip file in output dir
    const files = fs.readdirSync(packageDir)
    const zipFile = files.find((file) => file.endsWith('.zip'))
    expect(zipFile).toBeDefined()

    // Cleanup
    fs.rmSync(packageDir, {recursive: true, force: true})
  })
})

/**
 * Recursively copies a directory.
 */
function copyDirRecursive(src: string, dest: string): void {
  fs.mkdirSync(dest, {recursive: true})
  for (const entry of fs.readdirSync(src, {withFileTypes: true})) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

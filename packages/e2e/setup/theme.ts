/* eslint-disable no-restricted-imports */
import {authFixture} from './auth.js'
import * as path from 'path'
import * as fs from 'fs'
import {fileURLToPath} from 'url'
import type {ExecResult} from './cli.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const FIXTURE_DIR = path.join(__dirname, '../data/dawn-minimal')

export interface ThemeScaffold {
  /** The directory containing the theme files */
  themeDir: string
  /** Push theme to store, returns theme ID from output */
  push(opts?: {unpublished?: boolean; themeName?: string}): Promise<{result: ExecResult; themeId?: string}>
  /** Pull theme from store by ID */
  pull(themeId: string): Promise<ExecResult>
  /** List all themes on the store */
  list(): Promise<{result: ExecResult; themes: {id: string; name: string; role: string}[]}>
  /** Delete a theme by ID */
  delete(themeId: string): Promise<ExecResult>
  /** Rename a theme */
  rename(themeId: string, newName: string): Promise<ExecResult>
  /** Duplicate a theme (via push with development flag) */
  duplicate(themeId: string, newName: string): Promise<ExecResult>
}

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

/**
 * Test-scoped fixture that copies the dawn-minimal fixture to a temp directory.
 * Provides helper methods for theme CRUD operations.
 * Depends on authLogin (worker-scoped) for OAuth session.
 */
export const themeScaffoldFixture = authFixture.extend<{themeScaffold: ThemeScaffold}>({
  themeScaffold: async ({cli, env, authLogin: _authLogin}, use) => {
    const themeDir = fs.mkdtempSync(path.join(env.tempDir, 'theme-'))
    const createdThemeIds: string[] = []
    const storeFqdn = env.storeFqdn

    // Copy fixture files recursively
    copyDirRecursive(FIXTURE_DIR, themeDir)

    const scaffold: ThemeScaffold = {
      themeDir,

      async push(opts = {}) {
        const themeName = opts.themeName ?? `e2e-test-${Date.now()}`
        const args = ['theme', 'push', '--store', storeFqdn, '--path', themeDir, '--theme', themeName]
        if (opts.unpublished !== false) {
          args.push('--unpublished')
        }
        // Add --json for parseable output
        args.push('--json')

        const result = await cli.exec(args, {timeout: 2 * 60 * 1000})

        // Try to extract theme ID from JSON output
        let themeId: string | undefined
        try {
          const json = JSON.parse(result.stdout)
          if (json.theme?.id) {
            themeId = String(json.theme.id)
            createdThemeIds.push(themeId)
          }
        } catch (error) {
          // JSON parsing failed, try regex fallback
          if (!(error instanceof SyntaxError)) throw error
          const match = result.stdout.match(/theme[:\s]+(\d+)/i) ?? result.stderr.match(/theme[:\s]+(\d+)/i)
          if (match?.[1]) {
            themeId = match[1]
            createdThemeIds.push(themeId)
          }
        }

        return {result, themeId}
      },

      async pull(themeId: string) {
        return cli.exec(['theme', 'pull', '--store', storeFqdn, '--path', themeDir, '--theme', themeId], {
          timeout: 2 * 60 * 1000,
        })
      },

      async list() {
        const result = await cli.exec(['theme', 'list', '--store', storeFqdn, '--json'], {timeout: 60 * 1000})
        const themes: {id: string; name: string; role: string}[] = []

        try {
          const json = JSON.parse(result.stdout)
          if (Array.isArray(json)) {
            for (const theme of json) {
              themes.push({
                id: String(theme.id),
                name: theme.name ?? '',
                role: theme.role ?? '',
              })
            }
          }
        } catch (error) {
          // JSON parsing failed - return empty array
          if (!(error instanceof SyntaxError)) throw error
        }

        return {result, themes}
      },

      async delete(themeId: string) {
        const result = await cli.exec(['theme', 'delete', '--store', storeFqdn, '--theme', themeId, '--force'], {
          timeout: 60 * 1000,
        })
        // Remove from tracked IDs if successful
        const idx = createdThemeIds.indexOf(themeId)
        if (idx >= 0 && result.exitCode === 0) {
          createdThemeIds.splice(idx, 1)
        }
        return result
      },

      async rename(themeId: string, newName: string) {
        return cli.exec(['theme', 'rename', '--store', storeFqdn, '--theme', themeId, '--name', newName], {
          timeout: 60 * 1000,
        })
      },

      async duplicate(themeId: string, newName: string) {
        // Pull the theme first, then push with new name
        const pullResult = await this.pull(themeId)
        if (pullResult.exitCode !== 0) {
          return pullResult
        }
        const {result} = await this.push({themeName: newName})
        return result
      },
    }

    await use(scaffold)

    // Teardown: delete all themes created during the test (parallel for speed)
    await Promise.all(
      createdThemeIds.map((themeId) =>
        cli
          .exec(['theme', 'delete', '--store', storeFqdn, '--theme', themeId, '--force'], {timeout: 60 * 1000})
          .catch(() => {
            // Best effort cleanup - don't fail teardown
          }),
      ),
    )

    // Cleanup temp directory
    fs.rmSync(themeDir, {recursive: true, force: true})
  },
})

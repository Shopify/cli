/* eslint-disable no-restricted-imports */
import {themeScaffoldFixture as test} from '../setup/theme.js'
import {requireEnv} from '../setup/env.js'
import {expect} from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

test.describe('Theme CRUD operations', () => {
  test('push creates a development theme, list shows it, delete removes it', async ({themeScaffold, env}) => {
    requireEnv(env, 'storeFqdn')

    // Step 1: Push theme to create development theme
    const themeName = `e2e-test-crud-${Date.now()}`
    const {result: pushResult, themeId} = await themeScaffold.push({themeName, unpublished: true})

    expect(pushResult.exitCode).toBe(0)
    expect(themeId).toBeDefined()

    // Step 2: List themes and verify our theme appears
    const {result: listResult, themes} = await themeScaffold.list()
    expect(listResult.exitCode).toBe(0)

    const ourTheme = themes.find((t) => t.id === themeId)
    expect(ourTheme).toBeDefined()
    expect(ourTheme?.name).toBe(themeName)

    // Step 3: Delete the theme
    const deleteResult = await themeScaffold.delete(themeId!)
    expect(deleteResult.exitCode).toBe(0)

    // Step 4: Verify theme is gone
    const {themes: themesAfterDelete} = await themeScaffold.list()
    const deletedTheme = themesAfterDelete.find((t) => t.id === themeId)
    expect(deletedTheme).toBeUndefined()
  })

  test('pull downloads theme files', async ({themeScaffold, cli, env}) => {
    requireEnv(env, 'storeFqdn')

    // Step 1: Push a theme first
    const themeName = `e2e-test-pull-${Date.now()}`
    const {result: pushResult, themeId} = await themeScaffold.push({themeName, unpublished: true})
    expect(pushResult.exitCode).toBe(0)
    expect(themeId).toBeDefined()

    // Step 2: Create a clean directory and pull into it
    const pullDir = fs.mkdtempSync(path.join(env.tempDir, 'theme-pull-'))

    const pullResult = await cli.exec(
      ['theme', 'pull', '--store', env.storeFqdn, '--path', pullDir, '--theme', themeId!],
      {
        timeout: 2 * 60 * 1000,
      },
    )
    expect(pullResult.exitCode).toBe(0)

    // Step 3: Verify files were downloaded
    expect(fs.existsSync(path.join(pullDir, 'layout', 'theme.liquid'))).toBe(true)
    expect(fs.existsSync(path.join(pullDir, 'config', 'settings_schema.json'))).toBe(true)

    // Cleanup
    fs.rmSync(pullDir, {recursive: true, force: true})
    await themeScaffold.delete(themeId!)
  })

  test('rename changes theme name', async ({themeScaffold, env}) => {
    requireEnv(env, 'storeFqdn')

    // Step 1: Push a theme
    const originalName = `e2e-test-rename-${Date.now()}`
    const {result: pushResult, themeId} = await themeScaffold.push({themeName: originalName, unpublished: true})
    expect(pushResult.exitCode).toBe(0)
    expect(themeId).toBeDefined()

    // Step 2: Rename the theme
    const newName = `${originalName}-renamed`
    const renameResult = await themeScaffold.rename(themeId!, newName)
    expect(renameResult.exitCode).toBe(0)

    // Step 3: Verify the name changed
    const {themes} = await themeScaffold.list()
    const renamedTheme = themes.find((t) => t.id === themeId)
    expect(renamedTheme?.name).toBe(newName)

    // Cleanup
    await themeScaffold.delete(themeId!)
  })

  test('duplicate creates a copy of a theme', async ({themeScaffold, env}) => {
    requireEnv(env, 'storeFqdn')

    // Step 1: Push original theme
    const originalName = `e2e-test-dup-orig-${Date.now()}`
    const {result: pushResult, themeId: originalId} = await themeScaffold.push({
      themeName: originalName,
      unpublished: true,
    })
    expect(pushResult.exitCode).toBe(0)
    expect(originalId).toBeDefined()

    // Step 2: Duplicate the theme
    const duplicateName = `e2e-test-dup-copy-${Date.now()}`
    const duplicateResult = await themeScaffold.duplicate(originalId!, duplicateName)
    expect(duplicateResult.exitCode).toBe(0)

    // Step 3: Verify both themes exist
    const {themes} = await themeScaffold.list()
    const originalTheme = themes.find((t) => t.id === originalId)
    const duplicateTheme = themes.find((t) => t.name === duplicateName)

    expect(originalTheme).toBeDefined()
    expect(duplicateTheme).toBeDefined()
    expect(duplicateTheme?.id).not.toBe(originalId)

    // Cleanup (fixture will cleanup original, we need to cleanup duplicate)
    if (duplicateTheme?.id) {
      await themeScaffold.delete(duplicateTheme.id)
    }
    await themeScaffold.delete(originalId!)
  })

  test('push with --ignore excludes matching files', async ({themeScaffold, cli, env}) => {
    requireEnv(env, 'storeFqdn')

    // Step 1: Push a theme with --ignore to exclude snippets
    const themeName = `e2e-test-push-ignore-${Date.now()}`
    const pushResult = await cli.exec(
      [
        'theme',
        'push',
        '--store',
        env.storeFqdn,
        '--path',
        themeScaffold.themeDir,
        '--theme',
        themeName,
        '--unpublished',
        '--ignore',
        'snippets/*',
        '--json',
      ],
      {timeout: 2 * 60 * 1000},
    )
    expect(pushResult.exitCode).toBe(0)

    // Extract theme ID from JSON output
    let themeId: string | undefined
    try {
      const json = JSON.parse(pushResult.stdout)
      if (json.theme?.id) {
        themeId = String(json.theme.id)
      }
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error
    }
    expect(themeId).toBeDefined()

    // Step 2: Pull theme to new directory
    const pullDir = fs.mkdtempSync(path.join(env.tempDir, 'theme-pull-ignore-'))
    const pullResult = await cli.exec(
      ['theme', 'pull', '--store', env.storeFqdn, '--path', pullDir, '--theme', themeId!],
      {
        timeout: 2 * 60 * 1000,
      },
    )
    expect(pullResult.exitCode).toBe(0)

    // Step 3: Verify snippets were NOT uploaded (directory should be empty or missing)
    const snippetsDir = path.join(pullDir, 'snippets')
    if (fs.existsSync(snippetsDir)) {
      const snippetFiles = fs.readdirSync(snippetsDir)
      expect(snippetFiles.length).toBe(0)
    }
    // If snippets dir doesn't exist, that's also a pass

    // Cleanup
    fs.rmSync(pullDir, {recursive: true, force: true})
    await themeScaffold.delete(themeId!)
  })

  test('pull with --ignore excludes matching files', async ({themeScaffold, cli, env}) => {
    requireEnv(env, 'storeFqdn')

    // Step 1: Push a full theme first (including snippets)
    const themeName = `e2e-test-pull-ignore-${Date.now()}`
    const {result: pushResult, themeId} = await themeScaffold.push({themeName, unpublished: true})
    expect(pushResult.exitCode).toBe(0)
    expect(themeId).toBeDefined()

    // Step 2: Pull to new directory with --ignore to exclude snippets
    const pullDir = fs.mkdtempSync(path.join(env.tempDir, 'theme-pull-ignore-'))
    const pullResult = await cli.exec(
      ['theme', 'pull', '--store', env.storeFqdn, '--path', pullDir, '--theme', themeId!, '--ignore', 'snippets/*'],
      {timeout: 2 * 60 * 1000},
    )
    expect(pullResult.exitCode).toBe(0)

    // Step 3: Verify other files were downloaded but snippets were NOT
    expect(fs.existsSync(path.join(pullDir, 'layout', 'theme.liquid'))).toBe(true)
    expect(fs.existsSync(path.join(pullDir, 'config', 'settings_schema.json'))).toBe(true)

    // Snippets should be empty or missing
    const snippetsDir = path.join(pullDir, 'snippets')
    if (fs.existsSync(snippetsDir)) {
      const snippetFiles = fs.readdirSync(snippetsDir)
      expect(snippetFiles.length).toBe(0)
    }

    // Cleanup
    fs.rmSync(pullDir, {recursive: true, force: true})
    await themeScaffold.delete(themeId!)
  })

  test('list with --name filters themes by glob pattern', async ({themeScaffold, cli, env}) => {
    requireEnv(env, 'storeFqdn')

    // Step 1: Create a theme with a known prefix
    const timestamp = Date.now()
    const themeName = `e2e-glob-test-${timestamp}`
    const {result: pushResult, themeId} = await themeScaffold.push({themeName, unpublished: true})
    expect(pushResult.exitCode).toBe(0)
    expect(themeId).toBeDefined()

    // Step 2: List themes with --name glob that should match our theme
    const listResult = await cli.exec(
      ['theme', 'list', '--store', env.storeFqdn, '--name', 'e2e-glob-test-*', '--json'],
      {
        timeout: 60 * 1000,
      },
    )
    expect(listResult.exitCode).toBe(0)

    // Step 3: Parse results and verify only matching themes are returned
    let themes: {id: string; name: string}[] = []
    try {
      const json = JSON.parse(listResult.stdout)
      if (Array.isArray(json)) {
        themes = json.map((t: {id: number; name: string}) => ({id: String(t.id), name: t.name}))
      }
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error
    }

    // Our theme should be in the results
    const ourTheme = themes.find((t) => t.id === themeId)
    expect(ourTheme).toBeDefined()
    expect(ourTheme?.name).toBe(themeName)

    // All returned themes should match the glob pattern
    for (const theme of themes) {
      expect(theme.name).toMatch(/^e2e-glob-test-/)
    }

    // Cleanup
    await themeScaffold.delete(themeId!)
  })
})

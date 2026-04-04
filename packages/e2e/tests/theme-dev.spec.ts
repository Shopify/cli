/* eslint-disable no-restricted-imports */
import {themeScaffoldFixture as test} from '../setup/theme.js'
import {requireEnv} from '../setup/env.js'
import {expect} from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// Skip dev tests - store password not configured in CI yet
// See: https://github.com/Shopify/cli/pull/7034
test.describe.skip('Theme dev server', () => {
  test('dev starts, shows ready message, and quits with q', async ({themeScaffold, cli, env}) => {
    requireEnv(env, 'storeFqdn')

    // Step 1: Push a theme first so we have something to develop against
    const themeName = `e2e-test-dev-${Date.now()}`
    const {result: pushResult, themeId} = await themeScaffold.push({themeName, unpublished: true})
    expect(pushResult.exitCode).toBe(0)
    expect(themeId).toBeDefined()

    // Step 2: Start dev server via PTY
    // Unset CI so keyboard shortcuts are enabled
    // Pass store password if available (for password-protected stores)
    const devArgs = ['theme', 'dev', '--store', env.storeFqdn, '--path', themeScaffold.themeDir, '--theme', themeId!]
    if (env.storePassword) {
      devArgs.push('--store-password', env.storePassword)
    }
    const dev = await cli.spawn(devArgs, {
      env: {CI: ''},
    })

    // Step 3: Wait for the ready message
    // Theme dev prints a URL when ready
    await dev.waitForOutput('http://127.0.0.1', 2 * 60 * 1000)

    // Step 4: Verify keyboard shortcuts are shown (indicates TTY mode is working)
    const output = dev.getOutput()
    expect(output).toMatch(/q|quit|press/i)

    // Step 5: Press q to quit
    dev.sendKey('q')

    // Step 6: Wait for clean exit
    const exitCode = await dev.waitForExit(30_000)
    expect(exitCode).toBe(0)

    // Cleanup
    await themeScaffold.delete(themeId!)
  })

  test('dev syncs file changes and shows sync message', async ({themeScaffold, cli, env}) => {
    requireEnv(env, 'storeFqdn')

    // Step 1: Push a theme first so we have something to develop against
    const themeName = `e2e-test-dev-sync-${Date.now()}`
    const {result: pushResult, themeId} = await themeScaffold.push({themeName, unpublished: true})
    expect(pushResult.exitCode).toBe(0)
    expect(themeId).toBeDefined()

    // Step 2: Start dev server via PTY
    // Unset CI so keyboard shortcuts are enabled
    // Pass store password if available (for password-protected stores)
    const devArgs = ['theme', 'dev', '--store', env.storeFqdn, '--path', themeScaffold.themeDir, '--theme', themeId!]
    if (env.storePassword) {
      devArgs.push('--store-password', env.storePassword)
    }
    const dev = await cli.spawn(devArgs, {
      env: {CI: ''},
    })

    // Step 3: Wait for the ready message
    await dev.waitForOutput('http://127.0.0.1', 2 * 60 * 1000)

    // Step 4: Modify a file to trigger sync
    const headerPath = path.join(themeScaffold.themeDir, 'sections', 'header.liquid')
    const originalContent = fs.readFileSync(headerPath, 'utf-8')
    const modifiedContent = originalContent.replace('E2E Test Header', `E2E Test Header Modified ${Date.now()}`)
    fs.writeFileSync(headerPath, modifiedContent)

    // Step 5: Wait for sync message
    // Theme dev outputs: "• TIMESTAMP  Synced » update sections/header.liquid"
    await dev.waitForOutput('Synced', 60_000)

    // Step 6: Verify the sync message mentions our file
    const output = dev.getOutput()
    expect(output).toContain('header.liquid')

    // Step 7: Press q to quit
    dev.sendKey('q')

    // Step 8: Wait for clean exit
    const exitCode = await dev.waitForExit(30_000)
    expect(exitCode).toBe(0)

    // Cleanup
    await themeScaffold.delete(themeId!)
  })
})

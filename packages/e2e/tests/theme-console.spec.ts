import {themeScaffoldFixture as test} from '../setup/theme.js'
import {requireEnv} from '../setup/env.js'
import {expect} from '@playwright/test'

// Skip console tests - they hang in CI with no output, possibly due to auth/session handling
// See: https://github.com/Shopify/cli/pull/7034
test.describe.skip('Theme console', () => {
  test('console evaluates Liquid expressions', async ({themeScaffold, cli, env}) => {
    requireEnv(env, 'storeFqdn')

    // Step 1: Push a theme first so we have something to work with
    const themeName = `e2e-test-console-${Date.now()}`
    const {result: pushResult, themeId} = await themeScaffold.push({themeName, unpublished: true})
    expect(pushResult.exitCode).toBe(0)
    expect(themeId).toBeDefined()

    // Step 2: Start console via PTY
    // Unset CI so the REPL is interactive
    // Pass store password if available (for password-protected stores)
    const consoleArgs = ['theme', 'console', '--store', env.storeFqdn]
    if (env.storePassword) {
      consoleArgs.push('--store-password', env.storePassword)
    }
    const console = await cli.spawn(consoleArgs, {
      env: {CI: ''},
    })

    // Step 3: Wait for the console to be ready
    // Theme console outputs "Welcome to Shopify Liquid console" when ready
    await console.waitForOutput('Welcome to Shopify Liquid console', 60_000)

    // Step 4: Send a Liquid expression (without {{ }} delimiters - console doesn't support them)
    console.sendLine('1 | plus: 2')

    // Step 5: Wait for the result
    await console.waitForOutput('3', 30_000)

    // Step 6: Verify the result is in the output
    const output = console.getOutput()
    expect(output).toContain('3')

    // Step 7: Exit the console
    // Send Ctrl+C or type 'exit'
    // Ctrl+C
    console.sendKey('\x03')

    // Step 8: Wait for exit (may timeout if Ctrl+C doesn't work, that's OK)
    try {
      await console.waitForExit(10_000)
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (_error) {
      // Timeout errors are expected - force kill if it doesn't exit gracefully
      console.kill()
    }

    // Cleanup
    await themeScaffold.delete(themeId!)
  })

  test('console with --url evaluates in product context', async ({themeScaffold, cli, env}) => {
    requireEnv(env, 'storeFqdn')

    // Step 1: Push a theme first so we have something to work with
    const themeName = `e2e-test-console-url-${Date.now()}`
    const {result: pushResult, themeId} = await themeScaffold.push({themeName, unpublished: true})
    expect(pushResult.exitCode).toBe(0)
    expect(themeId).toBeDefined()

    // Step 2: Start console via PTY with --url pointing to products page
    // Using /products as a generic URL that should work on any store
    // Unset CI so the REPL is interactive
    // Pass store password if available (for password-protected stores)
    const consoleArgs = ['theme', 'console', '--store', env.storeFqdn, '--url', '/products']
    if (env.storePassword) {
      consoleArgs.push('--store-password', env.storePassword)
    }
    const consoleProc = await cli.spawn(consoleArgs, {
      env: {CI: ''},
    })

    // Step 3: Wait for the console to be ready
    // Theme console outputs "Welcome to Shopify Liquid console" when ready
    await consoleProc.waitForOutput('Welcome to Shopify Liquid console', 60_000)

    // Step 4: Try to evaluate something that would exist on a products page
    // Even if no products exist, the template context should be set
    // Note: console doesn't support {{ }} delimiters
    consoleProc.sendLine('request.path')

    // Step 5: Wait for output - should show /products or similar
    await consoleProc.waitForOutput('products', 30_000)

    // Step 6: Exit the console (Ctrl+C)
    consoleProc.sendKey('\x03')

    // Step 7: Wait for exit
    try {
      await consoleProc.waitForExit(10_000)
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (_error) {
      // Timeout errors are expected - force kill if it doesn't exit gracefully
      consoleProc.kill()
    }

    // Cleanup
    await themeScaffold.delete(themeId!)
  })
})

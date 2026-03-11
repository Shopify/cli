import {appScaffoldFixture as test} from '../setup/app.js'
import {requireEnv} from '../setup/env.js'
import {expect} from '@playwright/test'

test.describe('App dev server', () => {
  test('dev starts, shows ready message, and quits with q', async ({appScaffold, cli, env}) => {
    requireEnv(env, 'clientId', 'storeFqdn')

    // Step 1: Create an extension-only app (no scopes needed)
    const initResult = await appScaffold.init({
      template: 'none',
      packageManager: 'npm',
    })
    expect(initResult.exitCode).toBe(0)

    // Step 2: Start dev server via PTY
    // Unset CI so keyboard shortcuts are enabled in the Dev UI
    const dev = await cli.spawn(['app', 'dev', '--path', appScaffold.appDir], {env: {CI: ''}})

    // Step 3: Wait for the ready message
    await dev.waitForOutput('Ready, watching for changes in your app', 3 * 60 * 1000)

    // Step 4: Verify keyboard shortcuts are shown (indicates TTY mode is working)
    const output = dev.getOutput()
    expect(output).toContain('q')

    // Step 5: Press q to quit
    dev.sendKey('q')

    // Step 6: Wait for clean exit
    const exitCode = await dev.waitForExit(30_000)
    expect(exitCode).toBe(0)
  })
})

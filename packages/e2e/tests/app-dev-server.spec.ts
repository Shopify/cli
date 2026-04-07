import {appTestFixture as test, createApp, teardownApp} from '../setup/app.js'
import {requireEnv} from '../setup/env.js'
import {expect} from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path' // eslint-disable-line no-restricted-imports

test.describe('App dev server', () => {
  test('dev starts, shows ready message, and quits with q', async ({cli, env, browserPage}) => {
    test.setTimeout(10 * 60 * 1000)
    requireEnv(env, 'orgId', 'storeFqdn')

    const parentDir = fs.mkdtempSync(path.join(env.tempDir, 'app-'))
    const appName = `E2E-dev-${Date.now()}`

    try {
      // Step 1: Create an extension-only app (no scopes needed)
      const initResult = await createApp({
        cli,
        parentDir,
        name: appName,
        template: 'none',
        packageManager: 'npm',
        orgId: env.orgId,
      })
      expect(initResult.exitCode).toBe(0)
      const appDir = initResult.appDir

      // Step 2: Start dev server via PTY
      // Unset CI so keyboard shortcuts are enabled in the Dev UI
      const dev = await cli.spawn(['app', 'dev', '--path', appDir], {env: {CI: ''}})

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
    } finally {
      fs.rmSync(parentDir, {recursive: true, force: true})
      await teardownApp({browserPage, appName, email: process.env.E2E_ACCOUNT_EMAIL, orgId: env.orgId})
    }
  })
})

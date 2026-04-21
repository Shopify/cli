import {createApp} from '../setup/app.js'
import {teardownAll} from '../setup/teardown.js'
import {CLI_TIMEOUT, TEST_TIMEOUT} from '../setup/constants.js'
import {requireEnv} from '../setup/env.js'
import {storeTestFixture as test} from '../setup/store.js'
import {expect} from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path' // eslint-disable-line no-restricted-imports

test.describe('App dev server', () => {
  test('dev starts, shows ready message, and quits with q', async ({cli, env, browserPage, storeFqdn}) => {
    test.setTimeout(TEST_TIMEOUT.long)
    requireEnv(env, 'orgId')

    const parentDir = fs.mkdtempSync(path.join(env.tempDir, 'app-'))
    const appName = `E2E-dev-${Date.now()}`

    try {
      // Step 1: Create an extension-only app (no scopes needed)
      const initResult = await createApp({
        cli,
        parentDir,
        name: appName,
        template: 'none',
        packageManager: 'pnpm',
        orgId: env.orgId,
      })
      expect(initResult.exitCode, `createApp failed:\nstdout: ${initResult.stdout}\nstderr: ${initResult.stderr}`).toBe(
        0,
      )
      const appDir = initResult.appDir

      // Step 2: Start dev server via PTY, targeting the worker's store
      const dev = await cli.spawn(['app', 'dev', '--path', appDir], {
        env: {CI: '', SHOPIFY_FLAG_STORE: storeFqdn},
      })

      // Step 3: Wait for the ready message
      await dev.waitForOutput('Ready, watching for changes in your app', CLI_TIMEOUT.medium)

      // Step 4: Verify keyboard shortcuts are shown (indicates TTY mode is working)
      const output = dev.getOutput()
      expect(output).toContain('q')

      // Step 5: Press q to quit
      dev.sendKey('q')

      // Step 6: Wait for clean exit
      const exitCode = await dev.waitForExit(CLI_TIMEOUT.short)
      expect(exitCode, `dev exited with non-zero code. Output:\n${dev.getOutput()}`).toBe(0)
    } finally {
      // E2E_SKIP_TEARDOWN=1 skips teardown for debugging. Run cleanup scripts afterward.
      if (!process.env.E2E_SKIP_TEARDOWN) {
        fs.rmSync(parentDir, {recursive: true, force: true})
        await teardownAll({
          browserPage,
          appName,
          orgId: env.orgId,
          storeFqdn,
          workerIndex: env.workerIndex,
        })
      }
    }
  })
})

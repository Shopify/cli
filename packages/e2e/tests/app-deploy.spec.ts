import {appTestFixture as test, createApp, deployApp, versionsList, teardownApp} from '../setup/app.js'
import {requireEnv} from '../setup/env.js'
import {expect} from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path' // eslint-disable-line no-restricted-imports

test.describe('App deploy', () => {
  test('deploy and verify version exists', async ({cli, env, browserPage}) => {
    test.setTimeout(10 * 60 * 1000)
    requireEnv(env, 'orgId')

    const parentDir = fs.mkdtempSync(path.join(env.tempDir, 'app-'))
    const appName = `E2E-deploy-${Date.now()}`

    try {
      // Step 1: Create an extension-only app (no scopes needed for deploy)
      const initResult = await createApp({
        cli,
        parentDir,
        name: appName,
        template: 'none',
        packageManager: 'npm',
        orgId: env.orgId,
      })
      expect(initResult.exitCode, `createApp failed:\nstdout: ${initResult.stdout}\nstderr: ${initResult.stderr}`).toBe(
        0,
      )
      const appDir = initResult.appDir

      // Step 2: Deploy with a tagged version
      const versionTag = `e2e-v-${Date.now()}`
      const deployResult = await deployApp({cli, appDir, version: versionTag, message: 'E2E test deployment'})
      const deployOutput = deployResult.stdout + deployResult.stderr
      expect(deployResult.exitCode, `deploy failed:\n${deployOutput}`).toBe(0)

      // Step 3: Verify the version exists via versions list
      const listResult = await versionsList({cli, appDir})
      const listOutput = listResult.stdout + listResult.stderr
      expect(listResult.exitCode, `versions list failed:\n${listOutput}`).toBe(0)
      expect(listOutput).toContain(versionTag)
    } finally {
      fs.rmSync(parentDir, {recursive: true, force: true})
      await teardownApp({browserPage, appName, email: process.env.E2E_ACCOUNT_EMAIL, orgId: env.orgId})
    }
  })
})

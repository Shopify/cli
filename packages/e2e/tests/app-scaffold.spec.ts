/* eslint-disable no-restricted-imports */
import {appTestFixture as test, createApp, buildApp, generateExtension} from '../setup/app.js'
import {teardownAll} from '../setup/teardown.js'
import {TEST_TIMEOUT} from '../setup/constants.js'
import {requireEnv} from '../setup/env.js'
import {expect} from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

test.describe('App scaffold', () => {
  test('init creates a react-router app and builds', async ({cli, env, browserPage}) => {
    test.setTimeout(TEST_TIMEOUT.long)
    requireEnv(env, 'orgId')

    const parentDir = fs.mkdtempSync(path.join(env.tempDir, 'app-'))
    const appName = `E2E-scaffold-${Date.now()}`

    try {
      // Step 1: Create a new app from the react-router template
      const initResult = await createApp({
        cli,
        parentDir,
        name: appName,
        template: 'reactRouter',
        flavor: 'javascript',
        packageManager: 'pnpm',
        orgId: env.orgId,
      })
      expect(initResult.exitCode, `createApp failed:\nstdout: ${initResult.stdout}\nstderr: ${initResult.stderr}`).toBe(
        0,
      )
      const initOutput = initResult.stdout + initResult.stderr
      expect(initOutput).toContain('is ready for you to build!')
      const appDir = initResult.appDir

      // Step 2: Verify the app directory was created with expected files
      expect(fs.existsSync(appDir)).toBe(true)
      expect(fs.existsSync(path.join(appDir, 'shopify.app.toml'))).toBe(true)
      expect(fs.existsSync(path.join(appDir, 'package.json'))).toBe(true)

      // Step 3: Build the app
      const buildResult = await buildApp({cli, appDir})
      expect(
        buildResult.exitCode,
        `buildApp failed:\nstdout: ${buildResult.stdout}\nstderr: ${buildResult.stderr}`,
      ).toBe(0)
    } finally {
      // E2E_SKIP_CLEANUP=1 skips cleanup for debugging. Run `pnpm test:e2e-cleanup` afterward.
      if (!process.env.E2E_SKIP_CLEANUP) {
        fs.rmSync(parentDir, {recursive: true, force: true})
        await teardownAll({
          browserPage,
          appName,
          orgId: env.orgId,
          workerIndex: env.workerIndex,
        })
      }
    }
  })

  test('init creates an extension-only app', async ({cli, env, browserPage}) => {
    test.setTimeout(TEST_TIMEOUT.long)
    requireEnv(env, 'orgId')

    const parentDir = fs.mkdtempSync(path.join(env.tempDir, 'app-'))
    const appName = `E2E-ext-only-${Date.now()}`

    try {
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
      expect(fs.existsSync(initResult.appDir)).toBe(true)
      expect(fs.existsSync(path.join(initResult.appDir, 'shopify.app.toml'))).toBe(true)
    } finally {
      // E2E_SKIP_CLEANUP=1 skips cleanup for debugging. Run `pnpm test:e2e-cleanup` afterward.
      if (!process.env.E2E_SKIP_CLEANUP) {
        fs.rmSync(parentDir, {recursive: true, force: true})
        await teardownAll({
          browserPage,
          appName,
          orgId: env.orgId,
          workerIndex: env.workerIndex,
        })
      }
    }
  })

  // Extension generation hits businessPlatformOrganizationsRequest which returns 401
  // even with a valid OAuth session. The Business Platform Organizations API token
  // exchange needs investigation. OAuth login works, but this specific API rejects it.
  test.skip('generate extensions and build', async ({cli, env, browserPage}) => {
    test.setTimeout(TEST_TIMEOUT.long)
    requireEnv(env, 'orgId')

    const parentDir = fs.mkdtempSync(path.join(env.tempDir, 'app-'))
    const appName = `E2E-ext-gen-${Date.now()}`

    try {
      const initResult = await createApp({
        cli,
        parentDir,
        name: appName,
        template: 'reactRouter',
        flavor: 'javascript',
        packageManager: 'pnpm',
        orgId: env.orgId,
      })
      expect(initResult.exitCode, `createApp failed:\nstdout: ${initResult.stdout}\nstderr: ${initResult.stderr}`).toBe(
        0,
      )
      const appDir = initResult.appDir

      const extensionConfigs = [
        {name: 'test-product-sub', template: 'product_subscription_ui', flavor: 'react'},
        {name: 'test-theme-ext', template: 'theme_app_extension'},
      ]

      for (const ext of extensionConfigs) {
        // eslint-disable-next-line no-await-in-loop
        const result = await generateExtension({cli, appDir, ...ext})
        expect(
          result.exitCode,
          `generateExtension "${ext.name}" failed:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
        ).toBe(0)
      }

      const buildResult = await buildApp({cli, appDir})
      expect(
        buildResult.exitCode,
        `buildApp failed:\nstdout: ${buildResult.stdout}\nstderr: ${buildResult.stderr}`,
      ).toBe(0)
    } finally {
      // E2E_SKIP_CLEANUP=1 skips cleanup for debugging. Run `pnpm test:e2e-cleanup` afterward.
      if (!process.env.E2E_SKIP_CLEANUP) {
        fs.rmSync(parentDir, {recursive: true, force: true})
        await teardownAll({
          browserPage,
          appName,
          orgId: env.orgId,
          workerIndex: env.workerIndex,
        })
      }
    }
  })
})

/* eslint-disable no-restricted-imports */
import {appScaffoldFixture as test} from '../fixtures/app-scaffold.js'
import {requireEnv} from '../fixtures/env.js'
import {expect} from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

test.describe('App scaffold', () => {
  test('init creates a react-router app and builds', async ({appScaffold, env}) => {
    requireEnv(env, 'clientId')

    // Step 1: Create a new app from the react-router template
    const initResult = await appScaffold.init({
      template: 'reactRouter',
      flavor: 'javascript',
      packageManager: 'npm',
    })
    expect(initResult.exitCode).toBe(0)
    // Ink writes to stderr
    const initOutput = initResult.stdout + initResult.stderr
    expect(initOutput).toContain('is ready for you to build!')

    // Step 2: Verify the app directory was created with expected files
    expect(fs.existsSync(appScaffold.appDir)).toBe(true)
    expect(fs.existsSync(path.join(appScaffold.appDir, 'shopify.app.toml'))).toBe(true)
    expect(fs.existsSync(path.join(appScaffold.appDir, 'package.json'))).toBe(true)

    // Step 3: Build the app
    const buildResult = await appScaffold.build()
    expect(buildResult.exitCode, `build failed:\nstderr: ${buildResult.stderr}`).toBe(0)
  })

  test('init creates an extension-only app', async ({appScaffold, env}) => {
    requireEnv(env, 'clientId')

    const initResult = await appScaffold.init({
      name: 'e2e-ext-only',
      template: 'none',
      packageManager: 'npm',
    })
    expect(initResult.exitCode).toBe(0)
    expect(fs.existsSync(appScaffold.appDir)).toBe(true)
    expect(fs.existsSync(path.join(appScaffold.appDir, 'shopify.app.toml'))).toBe(true)
  })

  // Extension generation hits businessPlatformOrganizationsRequest which returns 401
  // even with a valid OAuth session. The Business Platform Organizations API token
  // exchange needs investigation. OAuth login works, but this specific API rejects it.
  test.skip('generate extensions and build', async ({appScaffold, env}) => {
    requireEnv(env, 'clientId')

    await appScaffold.init({
      template: 'reactRouter',
      flavor: 'javascript',
      packageManager: 'npm',
    })

    const extensionConfigs = [
      {name: 'test-product-sub', template: 'product_subscription_ui', flavor: 'react'},
      {name: 'test-theme-ext', template: 'theme_app_extension'},
    ]

    for (const ext of extensionConfigs) {
      // eslint-disable-next-line no-await-in-loop
      const result = await appScaffold.generateExtension(ext)
      expect(result.exitCode, `generate "${ext.name}" failed:\nstderr: ${result.stderr}`).toBe(0)
    }

    const buildResult = await appScaffold.build()
    expect(buildResult.exitCode, `build failed:\nstderr: ${buildResult.stderr}`).toBe(0)
  })
})

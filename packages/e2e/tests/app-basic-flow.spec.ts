/* eslint-disable no-restricted-imports */
import {
  appTestFixture as test,
  createApp,
  extractClientId,
  deployApp,
  versionsList,
  configLink,
  teardownApp,
} from '../setup/app.js'
import {CLI_TIMEOUT, TEST_TIMEOUT} from '../setup/constants.js'
import {requireEnv} from '../setup/env.js'
import {expect} from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

/**
 * App basic flow — from scratch (QA checklist: Apps section, no extensions).
 *
 * Exercises the full app lifecycle end-to-end:
 *   1. Create a new app from the reactRouter template
 *   2. Start dev server
 *   3. Run a GraphQL query via app execute
 *   4. Quit dev server with q
 *   5. Clean dev preview
 *   6. Deploy with a version tag
 *   7. Verify version in versions list
 *   8. Create a secondary app, config link to it
 *   9. Deploy to the secondary app
 */
test.describe('App basic flow — from scratch', () => {
  test('init, dev, execute, quit, clean, deploy, versions, config link, deploy to secondary', async ({
    cli,
    env,
    browserPage,
  }) => {
    test.setTimeout(TEST_TIMEOUT.long)
    requireEnv(env, 'orgId', 'storeFqdn')

    const parentDir = fs.mkdtempSync(path.join(env.tempDir, 'app-'))
    const appName = `E2E-basic-${Date.now()}`
    let secondaryParentDir = ''
    const secondaryAppName = `E2E-basic2-${Date.now()}`

    try {
      // Step 1: Create a new app
      const initResult = await createApp({
        cli,
        parentDir,
        name: appName,
        template: 'reactRouter',
        flavor: 'typescript',
        packageManager: 'npm',
        orgId: env.orgId,
      })
      expect(initResult.exitCode, `Step 1 - app init failed:\n${initResult.stderr}`).toBe(0)
      const appDir = initResult.appDir

      // Step 2: Start dev server (CI='' enables keyboard shortcuts)
      const dev = await cli.spawn(['app', 'dev', '--path', appDir], {env: {CI: ''}})
      try {
        await dev.waitForOutput('Ready, watching for changes in your app', CLI_TIMEOUT.medium)

        // Step 3: Run a GraphQL query
        const executeResult = await cli.exec(
          ['app', 'execute', '--query', 'query { shop { name } }', '--path', appDir],
          {timeout: CLI_TIMEOUT.short},
        )
        const executeOutput = executeResult.stdout + executeResult.stderr
        expect(executeResult.exitCode, `Step 3 - app execute failed:\n${executeOutput}`).toBe(0)
        expect(executeOutput, 'Step 3 - app execute: response missing "shop" field').toContain('shop')

        // Step 4: Quit dev server
        dev.sendKey('q')
        const devExitCode = await dev.waitForExit(CLI_TIMEOUT.short)
        expect(devExitCode, 'Step 4 - app dev quit failed').toBe(0)
      } finally {
        dev.kill()
      }

      // Step 5: Clean dev preview
      const cleanResult = await cli.exec(['app', 'dev', 'clean', '--path', appDir])
      const cleanOutput = cleanResult.stdout + cleanResult.stderr
      expect(cleanResult.exitCode, `Step 5 - app dev clean failed:\n${cleanOutput}`).toBe(0)
      expect(cleanOutput, 'Step 5 - missing "Dev preview stopped"').toContain('Dev preview stopped')

      // Step 6: Deploy with a version tag
      const versionTag = `E2E-v1-${Date.now()}`
      const deployResult = await deployApp({
        cli,
        appDir,
        version: versionTag,
        message: 'E2E basic flow deployment',
      })
      expect(deployResult.exitCode, `Step 6 - app deploy failed:\n${deployResult.stderr}`).toBe(0)

      // Step 7: Verify version in list
      const listResult = await versionsList({cli, appDir})
      const listOutput = listResult.stdout + listResult.stderr
      expect(listResult.exitCode, `Step 7 - versions list failed:\n${listOutput}`).toBe(0)
      expect(listOutput, `Step 7 - version tag "${versionTag}" not found`).toContain(versionTag)

      // Step 8: Create a secondary app and config link to it
      secondaryParentDir = fs.mkdtempSync(path.join(env.tempDir, 'app-'))
      const secondaryInit = await createApp({
        cli,
        parentDir: secondaryParentDir,
        name: secondaryAppName,
        template: 'reactRouter',
        flavor: 'typescript',
        packageManager: 'npm',
        orgId: env.orgId,
      })
      expect(secondaryInit.exitCode, `Step 8a - secondary app init failed:\n${secondaryInit.stderr}`).toBe(0)

      const secondaryClientId = extractClientId(secondaryInit.appDir)

      // Write a TOML stub so config link skips the "Configuration file name" prompt
      fs.writeFileSync(path.join(appDir, 'shopify.app.secondary.toml'), `client_id = "${secondaryClientId}"\n`)

      const linkResult = await configLink({cli, appDir, clientId: secondaryClientId})
      const linkOutput = linkResult.stdout + linkResult.stderr
      expect(linkResult.exitCode, `Step 8b - config link failed:\n${linkOutput}`).toBe(0)
      expect(linkOutput, 'Step 8b - missing "is now linked to"').toContain('is now linked to')

      // Step 9: Deploy to the secondary app
      const tomlFiles = fs
        .readdirSync(appDir)
        .filter(
          (file: string) => file.startsWith('shopify.app.') && file.endsWith('.toml') && file !== 'shopify.app.toml',
        )
      const secondaryConfig = tomlFiles[0]?.replace('shopify.app.', '').replace('.toml', '') ?? 'secondary'
      const secondaryVersionTag = `E2E-v2-${Date.now()}`
      const secondaryDeployResult = await deployApp({
        cli,
        appDir,
        config: secondaryConfig,
        version: secondaryVersionTag,
        message: 'E2E secondary deployment',
      })
      expect(secondaryDeployResult.exitCode, `Step 9 - secondary deploy failed:\n${secondaryDeployResult.stderr}`).toBe(
        0,
      )
    } finally {
      // E2E_SKIP_CLEANUP=1 skips cleanup for debugging. Run `pnpm test:e2e-cleanup` afterward.
      if (!process.env.E2E_SKIP_CLEANUP) {
        fs.rmSync(parentDir, {recursive: true, force: true})
        if (secondaryParentDir) fs.rmSync(secondaryParentDir, {recursive: true, force: true})
        await teardownApp({browserPage, appName, email: process.env.E2E_ACCOUNT_EMAIL, orgId: env.orgId})
        await teardownApp({
          browserPage,
          appName: secondaryAppName,
          email: process.env.E2E_ACCOUNT_EMAIL,
          orgId: env.orgId,
        })
      }
    }
  })
})

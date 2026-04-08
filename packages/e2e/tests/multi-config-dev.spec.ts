/* eslint-disable no-console */
/* eslint-disable no-restricted-imports */
import {appTestFixture as test, createApp, extractClientId, injectFixtureToml, teardownApp} from '../setup/app.js'
import {CLI_TIMEOUT, TEST_TIMEOUT} from '../setup/constants.js'
import {requireEnv} from '../setup/env.js'
import {expect} from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import {fileURLToPath} from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_TOML = fs.readFileSync(path.join(__dirname, '../data/valid-app/shopify.app.toml'), 'utf8')

test.describe('Multi-config dev', () => {
  test('dev with -c flag loads the named config', async ({cli, env, browserPage}) => {
    test.setTimeout(TEST_TIMEOUT.long)
    requireEnv(env, 'orgId', 'storeFqdn')

    const parentDir = fs.mkdtempSync(path.join(env.tempDir, 'app-'))
    const appName = `E2E-multi-cfg-${Date.now()}`

    try {
      const initResult = await createApp({cli, parentDir, name: appName, template: 'none', orgId: env.orgId})
      expect(initResult.exitCode, `createApp failed:\nstderr: ${initResult.stderr}`).toBe(0)
      const appDir = initResult.appDir

      // Inject the fully populated TOML as the default config
      injectFixtureToml(appDir, FIXTURE_TOML, appName)
      const clientId = extractClientId(appDir)

      // Create a second config: shopify.app.staging.toml
      // Uses the same client_id but different scopes to verify isolation
      const stagingToml = `
client_id = "${clientId}"
name = "E2E Staging Config"
application_url = "https://example.com"
embedded = true

extension_directories = ["staging-ext"]

[access_scopes]
scopes = "read_products"

[auth]
redirect_urls = ["https://example.com/auth/callback"]

[webhooks]
api_version = "2025-01"

[build]
automatically_update_urls_on_dev = true
include_config_on_deploy = true
`.trimStart()

      fs.writeFileSync(path.join(appDir, 'shopify.app.staging.toml'), stagingToml)
      fs.mkdirSync(path.join(appDir, 'staging-ext'), {recursive: true})

      // Start dev with -c staging.
      // --config and --client-id are mutually exclusive. CLIENT_ID is stripped globally in env.ts.
      const proc = await cli.spawn(
        ['app', 'dev', '--path', appDir, '-c', 'staging', '--skip-dependencies-installation'],
        {env: {CI: ''}},
      )

      try {
        await proc.waitForOutput('Ready, watching for changes in your app', CLI_TIMEOUT.medium)

        const output = proc.getOutput()

        expect(output, 'Expected staging config in info banner').toContain('Using shopify.app.staging.toml')
        expect(output, 'Expected staging scopes in output').toContain('read_products')
        expect(output, 'Should not contain write_products from default config').not.toContain('write_products')

        proc.sendKey('q')
        const exitCode = await proc.waitForExit(CLI_TIMEOUT.short)
        expect(exitCode, `dev exited with non-zero code. Output:\n${output}`).toBe(0)
      } catch (error) {
        console.error(`[multi-config dev] Captured PTY output:\n${proc.getOutput()}`)
        throw error
      } finally {
        proc.kill()
      }
    } finally {
      fs.rmSync(parentDir, {recursive: true, force: true})
      await teardownApp({browserPage, appName, email: process.env.E2E_ACCOUNT_EMAIL, orgId: env.orgId})
    }
  })

  test('dev without -c flag uses default config', async ({cli, env, browserPage}) => {
    test.setTimeout(TEST_TIMEOUT.long)
    requireEnv(env, 'orgId', 'storeFqdn')

    const parentDir = fs.mkdtempSync(path.join(env.tempDir, 'app-'))
    const appName = `E2E-mcfg-def-${Date.now()}`

    try {
      const initResult = await createApp({cli, parentDir, name: appName, template: 'none', orgId: env.orgId})
      expect(initResult.exitCode, `createApp failed:\nstderr: ${initResult.stderr}`).toBe(0)
      const appDir = initResult.appDir

      injectFixtureToml(appDir, FIXTURE_TOML, appName)
      const clientId = extractClientId(appDir)

      // Add a staging config so multiple configs exist
      const stagingToml = `
client_id = "${clientId}"
name = "E2E Staging Config"
application_url = "https://example.com"
embedded = true

[access_scopes]
scopes = "read_products"

[auth]
redirect_urls = ["https://example.com/auth/callback"]

[webhooks]
api_version = "2025-01"
`.trimStart()

      fs.writeFileSync(path.join(appDir, 'shopify.app.staging.toml'), stagingToml)

      // Start dev without -c flag — should use shopify.app.toml
      const proc = await cli.spawn(['app', 'dev', '--path', appDir, '--skip-dependencies-installation'], {
        env: {CI: ''},
      })

      try {
        await proc.waitForOutput('Ready, watching for changes in your app', CLI_TIMEOUT.medium)

        const output = proc.getOutput()

        expect(output, 'Expected default config in info banner').toContain('Using shopify.app.toml for default values')
        expect(output, 'Expected default scopes (write_products) in output').toContain('write_products')

        proc.sendKey('q')
        const exitCode = await proc.waitForExit(CLI_TIMEOUT.short)
        expect(exitCode, `dev exited with non-zero code. Output:\n${output}`).toBe(0)
      } catch (error) {
        console.error(`[multi-config default] Captured PTY output:\n${proc.getOutput()}`)
        throw error
      } finally {
        proc.kill()
      }
    } finally {
      fs.rmSync(parentDir, {recursive: true, force: true})
      await teardownApp({browserPage, appName, email: process.env.E2E_ACCOUNT_EMAIL, orgId: env.orgId})
    }
  })
})

/* eslint-disable no-console */
/* eslint-disable no-restricted-imports */
import {tomlAppFixture as test} from '../setup/toml-app.js'
import {requireEnv} from '../setup/env.js'
import {expect} from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Multi-config dev tests.
 *
 * These verify the three-stage pipeline (Project → config selection → app loading)
 * correctly selects and isolates configs when multiple shopify.app.<name>.toml files exist.
 *
 * The tomlAppFixture creates a temp directory with the valid-app fixture and injects the
 * real client_id. We add a second config (shopify.app.staging.toml) that uses the same
 * client_id but a different set of scopes and extension_directories, then verify that:
 *   1. `shopify app dev -c staging` uses the staging config (filename in App info)
 *   2. Without -c, the default shopify.app.toml is used
 *
 * NOTE: The `-c` / `--config` flag is exclusive with `--client-id` (and its env var
 * SHOPIFY_FLAG_CLIENT_ID). When passing `-c`, we must clear SHOPIFY_FLAG_CLIENT_ID
 * from the process environment so oclif doesn't reject the mutually exclusive flags.
 *
 * NOTE: The "App:" row in the App info tab shows the remote app title from Partners,
 * not the local TOML `name` field. Since both configs use the same client_id, the
 * remote title is identical. We assert on the Config: row (filename) instead.
 */
test.describe('Multi-config dev', () => {
  test('dev with -c flag loads the named config', async ({cli, env, tomlAppDir}) => {
    test.setTimeout(6 * 60 * 1000)
    requireEnv(env, 'clientId', 'storeFqdn')

    // Create a second config: shopify.app.staging.toml
    // Uses the same client_id (required to hit the same Partners app) but different
    // scopes and extension_directories so we can verify isolation.
    const stagingToml = `
client_id = "${env.clientId}"
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

    fs.writeFileSync(path.join(tomlAppDir, 'shopify.app.staging.toml'), stagingToml)

    // Create the staging extension directory (empty — no extensions).
    fs.mkdirSync(path.join(tomlAppDir, 'staging-ext'), {recursive: true})

    // Start dev with the -c flag pointing to the staging config.
    // IMPORTANT: --config and --client-id are mutually exclusive in appFlags,
    // so we must remove SHOPIFY_FLAG_CLIENT_ID from the env when using -c.
    // Setting to undefined (not '') causes the spawn helper to exclude it
    // from the child process environment entirely.
    const proc = await cli.spawn(
      ['app', 'dev', '--path', tomlAppDir, '-c', 'staging', '--skip-dependencies-installation'],
      {
        env: {CI: '', SHOPIFY_FLAG_CLIENT_ID: undefined} as NodeJS.ProcessEnv,
      },
    )

    try {
      // Wait for the dev session to become ready. This proves:
      // 1. The CLI resolved shopify.app.staging.toml (not default)
      // 2. Project.load + selectActiveConfig(project, 'staging') worked
      // 3. The app loaded and created a dev session successfully
      await proc.waitForOutput('Ready, watching for changes in your app', 3 * 60 * 1000)

      const output = proc.getOutput()

      // The info banner at startup confirms which config file is being used.
      // It prints "Using shopify.app.staging.toml for default values:"
      expect(output, 'Expected staging config in info banner').toContain('Using shopify.app.staging.toml')

      // The staging config has scopes = "read_products" (vs the default's
      // "read_products,write_products,read_orders"). The access scopes line
      // in the dev output confirms the correct config was loaded.
      expect(output, 'Expected staging scopes in output').toContain('read_products')
      expect(output, 'Should not contain write_products from default config').not.toContain('write_products')

      // Press 'a' to switch to the "App info" tab, which displays the config filename.
      proc.sendKey('a')
      await new Promise((resolve) => setTimeout(resolve, 2000))

      const outputAfterTab = proc.getOutput()

      // Verify the staging config filename appears in the App info tab.
      // The UI renders `Config: shopify.app.staging.toml` (just the basename).
      expect(outputAfterTab, 'Expected staging config filename in App info tab').toContain('shopify.app.staging.toml')

      // Clean exit
      proc.sendKey('q')
      const exitCode = await proc.waitForExit(30_000)
      expect(exitCode, `dev exited with non-zero code. Output:\n${outputAfterTab}`).toBe(0)
    } catch (error) {
      console.error(`[multi-config dev] Captured PTY output:\n${proc.getOutput()}`)
      throw error
    } finally {
      proc.kill()
    }
  })

  test('dev without -c flag uses default config', async ({cli, env, tomlAppDir}) => {
    test.setTimeout(6 * 60 * 1000)
    requireEnv(env, 'clientId', 'storeFqdn')

    // Add a staging config so multiple configs exist
    const stagingToml = `
client_id = "${env.clientId}"
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

    fs.writeFileSync(path.join(tomlAppDir, 'shopify.app.staging.toml'), stagingToml)

    // Start dev without -c flag — should use shopify.app.toml
    const proc = await cli.spawn(['app', 'dev', '--path', tomlAppDir, '--skip-dependencies-installation'], {
      env: {CI: ''},
    })

    try {
      await proc.waitForOutput('Ready, watching for changes in your app', 3 * 60 * 1000)

      const output = proc.getOutput()

      // The info banner should reference the default config.
      // Match the full phrase to avoid a false match against "shopify.app.staging.toml".
      expect(output, 'Expected default config in info banner').toContain('Using shopify.app.toml for default values')

      // The default config has the broader scopes including write_products
      expect(output, 'Expected default scopes (write_products) in output').toContain('write_products')

      proc.sendKey('q')
      const exitCode = await proc.waitForExit(30_000)
      expect(exitCode, `dev exited with non-zero code. Output:\n${output}`).toBe(0)
    } catch (error) {
      console.error(`[multi-config default] Captured PTY output:\n${proc.getOutput()}`)
      throw error
    } finally {
      proc.kill()
    }
  })
})

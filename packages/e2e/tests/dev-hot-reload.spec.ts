/* eslint-disable no-console */
/* eslint-disable no-restricted-imports */
import {tomlAppFixture as test} from '../setup/toml-app.js'
import {requireEnv} from '../setup/env.js'
import {expect} from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Dev hot-reload tests.
 *
 * These exercise the file watcher and dev-session reload pipeline end-to-end:
 *   - Editing the app config TOML triggers a reload
 *   - Creating a new extension mid-dev is detected by the file watcher
 *   - Deleting an extension mid-dev is detected by the file watcher
 *
 * All tests start `shopify app dev` via PTY (with no custom extensions — just the
 * built-in config extensions from the app TOML), wait for the initial "Ready" message,
 * then mutate the filesystem and assert on the CLI's output messages.
 *
 * Key output strings we assert on (from dev-session-logger.ts / dev-session-status-manager.ts):
 *   - "Ready, watching for changes in your app" — initial ready
 *   - "Updated dev preview on <store>"           — successful dev session update
 *   - "App config updated"                       — app TOML change detected
 *   - "Extension created"                        — new extension detected by watcher
 *   - "Extension deleted"                        — extension removal detected by watcher
 *
 * For the app config edit test, we modify scopes in shopify.app.toml which triggers
 * the reload pipeline through the config extensions (app_access, etc.) without needing
 * any custom extensions — this matches the existing toml-config fixture exactly.
 *
 * For create/delete tests, we use flow_trigger extensions (build mode "none" — no
 * compilation, no theme-check). The dev session API may reject these extensions with
 * a validation error, but the watcher detection and app reload still happen and are
 * what we assert on. The CLI stays alive after API errors.
 */

const READY_MESSAGE = 'Ready, watching for changes in your app'
const UPDATED_MESSAGE = 'Updated dev preview'

/**
 * Write a minimal flow_trigger extension to disk. Flow triggers have build mode 'none'
 * so they don't trigger compilation, theme-check, or npm installs.
 */
function writeFlowTriggerExtension(appDir: string, name: string) {
  const extDir = path.join(appDir, 'extensions', name)
  fs.mkdirSync(extDir, {recursive: true})

  fs.writeFileSync(
    path.join(extDir, 'shopify.extension.toml'),
    `
type = "flow_trigger"
name = "${name}"
handle = "${name}"
description = "E2E test trigger"
`.trimStart(),
  )

  return extDir
}

test.describe('Dev hot reload', () => {
  test('editing app config TOML triggers reload', async ({cli, env, tomlAppDir}) => {
    test.setTimeout(6 * 60 * 1000)
    requireEnv(env, 'clientId', 'storeFqdn')

    // Start dev with no custom extensions — just the app config
    const proc = await cli.spawn(['app', 'dev', '--path', tomlAppDir, '--skip-dependencies-installation'], {
      env: {CI: ''},
    })

    try {
      await proc.waitForOutput(READY_MESSAGE, 3 * 60 * 1000)

      // Edit the app config TOML — change the scopes. This fires 'extensions_config_updated'
      // on the app config path, triggering a full app reload. The app_access config extension
      // will be detected as changed in the diff.
      const tomlPath = path.join(tomlAppDir, 'shopify.app.toml')
      const original = fs.readFileSync(tomlPath, 'utf8')
      fs.writeFileSync(
        tomlPath,
        original.replace(
          'scopes = "read_products,write_products,read_orders"',
          'scopes = "read_products,write_products"',
        ),
      )

      // The reload pipeline fires: file watcher → app reload → diff → dev session UPDATE.
      // The logger emits "App config updated" for app config extension events.
      await proc.waitForOutput('App config updated', 2 * 60 * 1000)

      // After the update completes, "Updated dev preview" is logged.
      await proc.waitForOutput(UPDATED_MESSAGE, 2 * 60 * 1000)

      const output = proc.getOutput()

      // The scopes change was detected and the dev session was updated.
      expect(output, 'Expected app config update in output').toContain('App config updated')
      expect(output, 'Expected dev preview update in output').toContain(UPDATED_MESSAGE)

      // Clean exit
      proc.sendKey('q')
      const exitCode = await proc.waitForExit(30_000)
      expect(exitCode, `dev exited with non-zero code. Output:\n${output}`).toBe(0)
    } catch (error) {
      console.error(`[hot-reload app-config] Captured PTY output:\n${proc.getOutput()}`)
      throw error
    } finally {
      proc.kill()
    }
  })

  test('creating a new extension mid-dev is detected', async ({cli, env, tomlAppDir}) => {
    test.setTimeout(6 * 60 * 1000)
    requireEnv(env, 'clientId', 'storeFqdn')

    // Start dev with no custom extensions
    const proc = await cli.spawn(['app', 'dev', '--path', tomlAppDir, '--skip-dependencies-installation'], {
      env: {CI: ''},
    })

    try {
      await proc.waitForOutput(READY_MESSAGE, 3 * 60 * 1000)

      // Create a new extension on disk while dev is running.
      // The file watcher sees the new shopify.extension.toml, waits for the
      // .shopify.lock file to be absent, then fires 'extension_folder_created'.
      // This triggers a full app reload.
      writeFlowTriggerExtension(tomlAppDir, 'mid-dev-ext')

      // Wait for the watcher to detect the new extension. The reload-app handler
      // diffs old vs new app and logs "Extension created" for new extensions.
      // NOTE: The dev session API may reject the extension with a validation error,
      // but the watcher detection and reload still happen — that's what we test here.
      await proc.waitForOutput('Extension created', 2 * 60 * 1000)

      const output = proc.getOutput()
      expect(output, 'Expected extension created event in output').toContain('Extension created')

      // The CLI should NOT crash after an API error — it stays alive for further changes.
      // Verify this by checking the process is still running (sendKey would throw if dead).
      proc.sendKey('q')
      const exitCode = await proc.waitForExit(30_000)
      expect(exitCode, `dev exited with non-zero code. Output:\n${output}`).toBe(0)
    } catch (error) {
      console.error(`[hot-reload create] Captured PTY output:\n${proc.getOutput()}`)
      throw error
    } finally {
      proc.kill()
    }
  })

  test('deleting an extension mid-dev is detected', async ({cli, env, tomlAppDir}) => {
    test.setTimeout(6 * 60 * 1000)
    requireEnv(env, 'clientId', 'storeFqdn')

    // Start dev with no custom extensions
    const proc = await cli.spawn(['app', 'dev', '--path', tomlAppDir, '--skip-dependencies-installation'], {
      env: {CI: ''},
    })

    try {
      await proc.waitForOutput(READY_MESSAGE, 3 * 60 * 1000)

      // First, create an extension mid-dev so we have something to delete.
      // We know from the previous test that creation is detected even if the API
      // rejects the extension.
      writeFlowTriggerExtension(tomlAppDir, 'doomed-ext')
      await proc.waitForOutput('Extension created', 2 * 60 * 1000)

      // Give the dev session time to settle (process the create event fully)
      // before triggering the delete. The watcher debounce is 200ms.
      await new Promise((resolve) => setTimeout(resolve, 5000))

      // Delete the extension directory while dev is running.
      // The file watcher detects the shopify.extension.toml unlink and fires
      // 'extension_folder_deleted'. The handler removes the extension from the
      // app and emits a Deleted event.
      fs.rmSync(path.join(tomlAppDir, 'extensions', 'doomed-ext'), {recursive: true, force: true})

      // Wait for the watcher to detect the deletion.
      await proc.waitForOutput('Extension deleted', 2 * 60 * 1000)

      const output = proc.getOutput()
      expect(output, 'Expected extension deleted event in output').toContain('Extension deleted')

      // The CLI should stay alive and exit cleanly after create+delete cycle.
      proc.sendKey('q')
      const exitCode = await proc.waitForExit(30_000)
      expect(exitCode, `dev exited with non-zero code. Output:\n${output}`).toBe(0)
    } catch (error) {
      console.error(`[hot-reload delete] Captured PTY output:\n${proc.getOutput()}`)
      throw error
    } finally {
      proc.kill()
    }
  })
})

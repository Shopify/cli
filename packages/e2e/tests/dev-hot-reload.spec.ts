/* eslint-disable no-console */
/* eslint-disable no-restricted-imports */
import {appTestFixture as test, createApp, injectFixtureToml, teardownApp} from '../setup/app.js'
import {requireEnv} from '../setup/env.js'
import {expect} from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import {fileURLToPath} from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_TOML = fs.readFileSync(path.join(__dirname, '../data/valid-app/shopify.app.toml'), 'utf8')

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
  test('editing app config TOML triggers reload', async ({cli, env, browserPage}) => {
    test.setTimeout(10 * 60 * 1000)
    requireEnv(env, 'orgId', 'storeFqdn')

    const parentDir = fs.mkdtempSync(path.join(env.tempDir, 'app-'))
    const appName = `E2E-hot-reload-${Date.now()}`

    try {
      const initResult = await createApp({cli, parentDir, name: appName, template: 'none', orgId: env.orgId})
      expect(initResult.exitCode, `createApp failed:\nstderr: ${initResult.stderr}`).toBe(0)
      const appDir = initResult.appDir

      injectFixtureToml(appDir, FIXTURE_TOML, appName)

      const proc = await cli.spawn(['app', 'dev', '--path', appDir, '--skip-dependencies-installation'], {
        env: {CI: ''},
      })

      try {
        await proc.waitForOutput(READY_MESSAGE, 3 * 60 * 1000)

        // Edit scopes in the TOML to trigger a reload
        const tomlPath = path.join(appDir, 'shopify.app.toml')
        const original = fs.readFileSync(tomlPath, 'utf8')
        fs.writeFileSync(
          tomlPath,
          original.replace(
            'scopes = "read_products,write_products,read_orders"',
            'scopes = "read_products,write_products"',
          ),
        )

        await proc.waitForOutput('App config updated', 2 * 60 * 1000)
        await proc.waitForOutput(UPDATED_MESSAGE, 2 * 60 * 1000)

        const output = proc.getOutput()
        expect(output, 'Expected app config update in output').toContain('App config updated')
        expect(output, 'Expected dev preview update in output').toContain(UPDATED_MESSAGE)

        proc.sendKey('q')
        const exitCode = await proc.waitForExit(30_000)
        expect(exitCode, `dev exited with non-zero code. Output:\n${output}`).toBe(0)
      } catch (error) {
        console.error(`[hot-reload app-config] Captured PTY output:\n${proc.getOutput()}`)
        throw error
      } finally {
        proc.kill()
      }
    } finally {
      // E2E_SKIP_CLEANUP=1 skips cleanup for debugging. Run `pnpm test:e2e-cleanup` afterward.
      if (!process.env.E2E_SKIP_CLEANUP) {
        fs.rmSync(parentDir, {recursive: true, force: true})
        await teardownApp({browserPage, appName, email: process.env.E2E_ACCOUNT_EMAIL, orgId: env.orgId})
      }
    }
  })

  test('creating a new extension mid-dev is detected', async ({cli, env, browserPage}) => {
    test.setTimeout(10 * 60 * 1000)
    requireEnv(env, 'orgId', 'storeFqdn')

    const parentDir = fs.mkdtempSync(path.join(env.tempDir, 'app-'))
    const appName = `E2E-hot-create-${Date.now()}`

    try {
      const initResult = await createApp({cli, parentDir, name: appName, template: 'none', orgId: env.orgId})
      expect(initResult.exitCode, `createApp failed:\nstderr: ${initResult.stderr}`).toBe(0)
      const appDir = initResult.appDir

      injectFixtureToml(appDir, FIXTURE_TOML, appName)

      const proc = await cli.spawn(['app', 'dev', '--path', appDir, '--skip-dependencies-installation'], {
        env: {CI: ''},
      })

      try {
        await proc.waitForOutput(READY_MESSAGE, 3 * 60 * 1000)

        writeFlowTriggerExtension(appDir, 'mid-dev-ext')

        await proc.waitForOutput('Extension created', 2 * 60 * 1000)

        const output = proc.getOutput()
        expect(output, 'Expected extension created event in output').toContain('Extension created')

        proc.sendKey('q')
        const exitCode = await proc.waitForExit(30_000)
        expect(exitCode, `dev exited with non-zero code. Output:\n${output}`).toBe(0)
      } catch (error) {
        console.error(`[hot-reload create] Captured PTY output:\n${proc.getOutput()}`)
        throw error
      } finally {
        proc.kill()
      }
    } finally {
      // E2E_SKIP_CLEANUP=1 skips cleanup for debugging. Run `pnpm test:e2e-cleanup` afterward.
      if (!process.env.E2E_SKIP_CLEANUP) {
        fs.rmSync(parentDir, {recursive: true, force: true})
        await teardownApp({browserPage, appName, email: process.env.E2E_ACCOUNT_EMAIL, orgId: env.orgId})
      }
    }
  })

  test('deleting an extension mid-dev is detected', async ({cli, env, browserPage}) => {
    test.setTimeout(10 * 60 * 1000)
    requireEnv(env, 'orgId', 'storeFqdn')

    const parentDir = fs.mkdtempSync(path.join(env.tempDir, 'app-'))
    const appName = `E2E-hot-delete-${Date.now()}`

    try {
      const initResult = await createApp({cli, parentDir, name: appName, template: 'none', orgId: env.orgId})
      expect(initResult.exitCode, `createApp failed:\nstderr: ${initResult.stderr}`).toBe(0)
      const appDir = initResult.appDir

      injectFixtureToml(appDir, FIXTURE_TOML, appName)

      const proc = await cli.spawn(['app', 'dev', '--path', appDir, '--skip-dependencies-installation'], {
        env: {CI: ''},
      })

      try {
        await proc.waitForOutput(READY_MESSAGE, 3 * 60 * 1000)

        writeFlowTriggerExtension(appDir, 'doomed-ext')
        await proc.waitForOutput('Extension created', 2 * 60 * 1000)

        // Wait for the dev session to settle before deleting
        await new Promise((resolve) => setTimeout(resolve, 5000))

        fs.rmSync(path.join(appDir, 'extensions', 'doomed-ext'), {recursive: true, force: true})

        await proc.waitForOutput('Extension deleted', 2 * 60 * 1000)

        const output = proc.getOutput()
        expect(output, 'Expected extension deleted event in output').toContain('Extension deleted')

        proc.sendKey('q')
        const exitCode = await proc.waitForExit(30_000)
        expect(exitCode, `dev exited with non-zero code. Output:\n${output}`).toBe(0)
      } catch (error) {
        console.error(`[hot-reload delete] Captured PTY output:\n${proc.getOutput()}`)
        throw error
      } finally {
        proc.kill()
      }
    } finally {
      // E2E_SKIP_CLEANUP=1 skips cleanup for debugging. Run `pnpm test:e2e-cleanup` afterward.
      if (!process.env.E2E_SKIP_CLEANUP) {
        fs.rmSync(parentDir, {recursive: true, force: true})
        await teardownApp({browserPage, appName, email: process.env.E2E_ACCOUNT_EMAIL, orgId: env.orgId})
      }
    }
  })
})

/* eslint-disable no-console */
/* eslint-disable no-restricted-imports */
import {appTestFixture as test, createApp, injectFixtureToml, teardownApp} from '../setup/app.js'
import {CLI_TIMEOUT, TEST_TIMEOUT} from '../setup/constants.js'
import {requireEnv} from '../setup/env.js'
import {expect} from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import {fileURLToPath} from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_TOML = fs.readFileSync(path.join(__dirname, '../data/valid-app/shopify.app.toml'), 'utf8')

test.describe('TOML config regression', () => {
  test('deploy succeeds with fully populated toml', async ({cli, env, browserPage}) => {
    test.setTimeout(TEST_TIMEOUT.long)
    requireEnv(env, 'orgId')

    const parentDir = fs.mkdtempSync(path.join(env.tempDir, 'app-'))
    const appName = `E2E-toml-deploy-${Date.now()}`

    try {
      const initResult = await createApp({cli, parentDir, name: appName, template: 'none', orgId: env.orgId})
      expect(initResult.exitCode, `createApp failed:\nstderr: ${initResult.stderr}`).toBe(0)
      const appDir = initResult.appDir

      // Overwrite with fully populated TOML fixture (injects the real client_id)
      injectFixtureToml(appDir, FIXTURE_TOML, appName)

      const result = await cli.exec(['app', 'deploy', '--path', appDir, '--force'], {
        timeout: CLI_TIMEOUT.long,
      })
      const output = result.stdout + result.stderr
      expect(result.exitCode, `deploy failed:\n${output}`).toBe(0)
    } finally {
      // E2E_SKIP_CLEANUP=1 skips cleanup for debugging. Run `pnpm test:e2e-cleanup` afterward.
      if (!process.env.E2E_SKIP_CLEANUP) {
        fs.rmSync(parentDir, {recursive: true, force: true})
        await teardownApp({browserPage, appName, email: process.env.E2E_ACCOUNT_EMAIL, orgId: env.orgId})
      }
    }
  })

  test('dev starts with fully populated toml', async ({cli, env, browserPage}) => {
    test.setTimeout(TEST_TIMEOUT.long)
    requireEnv(env, 'orgId', 'storeFqdn')

    const parentDir = fs.mkdtempSync(path.join(env.tempDir, 'app-'))
    const appName = `E2E-toml-dev-${Date.now()}`

    try {
      const initResult = await createApp({cli, parentDir, name: appName, template: 'none', orgId: env.orgId})
      expect(initResult.exitCode, `createApp failed:\nstderr: ${initResult.stderr}`).toBe(0)
      const appDir = initResult.appDir

      injectFixtureToml(appDir, FIXTURE_TOML, appName)

      const proc = await cli.spawn(['app', 'dev', '--path', appDir], {env: {CI: ''}})

      try {
        await proc.waitForOutput('Ready, watching for changes in your app', CLI_TIMEOUT.medium)

        proc.sendKey('q')
        const exitCode = await proc.waitForExit(CLI_TIMEOUT.short)
        expect(exitCode, `dev exited with non-zero code. Output:\n${proc.getOutput()}`).toBe(0)
      } catch (error) {
        console.error(`[toml-config dev] Captured PTY output:\n${proc.getOutput()}`)
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

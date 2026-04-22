/* eslint-disable no-restricted-imports */
import {appTestFixture as test, createApp, deployApp, versionsList, configLink} from '../setup/app.js'
import {teardownAll} from '../setup/teardown.js'
import {TEST_TIMEOUT} from '../setup/constants.js'
import {requireEnv} from '../setup/env.js'
import {expect} from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Test A — full deploy lifecycle (QA checklist: Apps section, deploy flow).
 *
 *   1. `app init` Create primary app (React Router + JavaScript)
 *   2. `app deploy --version v1` Deploy with a version tag
 *   3. `app versions list` Verify the primary tag is active and no other
 *      version is stuck active
 *   4. `app config link` from primary dir → creates a brand-new secondary app
 *      interactively (answers org → "Create new?" → app name; config name
 *      prompt is skipped via `--config secondary`)
 *   5. `app deploy --config secondary` Deploy from primary dir to secondary app
 *   6. `app versions list --config secondary` Verify the secondary deploy hit
 *      the secondary app (not a silent fallback to primary) and the primary
 *      tag does not leak into secondary's list
 *
 * Test body is pure CLI; teardown uses the dev dashboard to delete both apps.
 */

interface VersionLine {
  versionTag?: string | null
  status: string
}

/**
 * Asserts a `versions list --json` result shows:
 *   - `expectedTag` is present and `active`
 *   - no other version is stuck `active`
 *   - (if `forbiddenTag` provided) `forbiddenTag` does not appear at all
 *
 * The last check guards cross-app leakage: a version we expect to live on one
 * app should never appear in another app's version list.
 */
function assertActiveVersion(opts: {
  result: {stdout: string; stderr: string; exitCode: number}
  expectedTag: string
  step: string
  forbiddenTag?: string
}) {
  const {result, expectedTag, step, forbiddenTag} = opts
  const output = result.stdout + result.stderr
  expect(result.exitCode, `${step} - versions list failed:\n${output}`).toBe(0)
  const versions = JSON.parse(result.stdout) as VersionLine[]
  const entry = versions.find((version) => version.versionTag === expectedTag)
  expect(entry, `${step} - version tag "${expectedTag}" not found in:\n${result.stdout}`).toBeDefined()
  expect(entry?.status, `${step} - expected "${expectedTag}" to be active, got "${entry?.status}"`).toBe('active')
  const otherActive = versions.filter((version) => version.versionTag !== expectedTag && version.status === 'active')
  expect(otherActive, `${step} - unexpected other active versions: ${JSON.stringify(otherActive)}`).toHaveLength(0)
  if (forbiddenTag) {
    const tags = versions.map((version) => version.versionTag)
    expect(tags, `${step} - tag "${forbiddenTag}" unexpectedly found in list`).not.toContain(forbiddenTag)
  }
}

test.describe('App deploy', () => {
  test('init, deploy, versions list, config link, deploy to secondary', async ({cli, env, browserPage}) => {
    test.setTimeout(TEST_TIMEOUT.long)
    requireEnv(env, 'orgId')

    const parentDir = fs.mkdtempSync(path.join(env.tempDir, 'app-'))
    const appName = `E2E-deploy1-${Date.now()}`
    const secondaryAppName = `E2E-deploy2-${Date.now()}`

    try {
      // Step 1: Create primary app (React Router template)
      const initResult = await createApp({
        cli,
        parentDir,
        name: appName,
        template: 'reactRouter',
        flavor: 'javascript',
        packageManager: 'pnpm',
        orgId: env.orgId,
      })
      expect(initResult.exitCode, `Step 1 - primary app init failed:\n${initResult.stderr}`).toBe(0)
      const appDir = initResult.appDir

      // Step 2: Deploy with a tagged version
      const versionTag = `E2E-v1-${Date.now()}`
      const deployResult = await deployApp({cli, appDir, version: versionTag, message: 'E2E A primary deployment'})
      const deployOutput = deployResult.stdout + deployResult.stderr
      expect(deployResult.exitCode, `Step 2 - deploy failed:\n${deployOutput}`).toBe(0)

      // Step 3: Verify the primary tag is active and no other version is stuck active.
      const listResult = await versionsList({cli, appDir})
      assertActiveVersion({result: listResult, expectedTag: versionTag, step: 'Step 3'})

      // Step 4: Config link from primary dir → creates a brand-new secondary app
      // interactively (org → "Create new?" → "App name"). The "Configuration file
      // name" prompt is skipped via `--config secondary`.
      const secondaryConfig = 'secondary'
      const linkResult = await configLink({
        cli,
        appDir,
        appName: secondaryAppName,
        orgId: env.orgId,
        configName: secondaryConfig,
      })
      const linkOutput = linkResult.stdout + linkResult.stderr
      expect(linkResult.exitCode, `Step 4 - config link failed:\n${linkOutput}`).toBe(0)
      expect(linkOutput, 'Step 4 - missing "is now linked to"').toContain('is now linked to')
      const secondaryTomlPath = path.join(appDir, `shopify.app.${secondaryConfig}.toml`)
      expect(
        fs.existsSync(secondaryTomlPath),
        `Step 4 - expected ${secondaryTomlPath} to exist after config link`,
      ).toBe(true)

      // Step 5: Deploy from primary dir to secondary app via --config secondary
      const secondaryVersionTag = `E2E-v2-${Date.now()}`
      const secondaryDeployResult = await deployApp({
        cli,
        appDir,
        config: secondaryConfig,
        version: secondaryVersionTag,
        message: 'E2E A secondary deployment',
      })
      const secondaryDeployOutput = secondaryDeployResult.stdout + secondaryDeployResult.stderr
      expect(secondaryDeployResult.exitCode, `Step 5 - secondary deploy failed:\n${secondaryDeployOutput}`).toBe(0)

      // Step 6: Verify the secondary deploy hit the secondary app (not a silent
      // fallback to primary). Checks the secondary tag is active, no other
      // version is stuck active, and the primary tag doesn't leak into secondary.
      const secondaryListResult = await versionsList({cli, appDir, config: secondaryConfig})
      assertActiveVersion({
        result: secondaryListResult,
        expectedTag: secondaryVersionTag,
        step: 'Step 6',
        forbiddenTag: versionTag,
      })
    } finally {
      // E2E_SKIP_TEARDOWN=1 skips teardown for debugging. Run cleanup scripts afterward.
      if (!process.env.E2E_SKIP_TEARDOWN) {
        fs.rmSync(parentDir, {recursive: true, force: true})
        // Neither app was installed on a store — delete the apps only (no uninstall)
        await teardownAll({
          browserPage,
          appName,
          orgId: env.orgId,
          workerIndex: env.workerIndex,
        })
        await teardownAll({
          browserPage,
          appName: secondaryAppName,
          orgId: env.orgId,
          workerIndex: env.workerIndex,
        })
      }
    }
  })
})

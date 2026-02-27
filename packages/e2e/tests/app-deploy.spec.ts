import {appScaffoldFixture as test} from '../fixtures/app-scaffold.js'
import {requireEnv} from '../fixtures/env.js'
import {expect} from '@playwright/test'

test.describe('App deploy @phase1', () => {
  test('deploy and verify version exists', async ({appScaffold, cli, env}) => {
    requireEnv(env, 'partnersToken', 'clientId')

    // Step 1: Create an app
    const initResult = await appScaffold.init({
      template: 'reactRouter',
      flavor: 'javascript',
      packageManager: 'npm',
    })
    expect(initResult.exitCode).toBe(0)

    // Step 2: Deploy with a tagged version
    const versionTag = `e2e-v-${Date.now()}`
    const deployResult = await cli.exec(
      [
        'app', 'deploy',
        '--path', appScaffold.appDir,
        '--force',
        '--version', versionTag,
        '--message', 'E2E test deployment',
      ],
      {timeout: 5 * 60 * 1000},
    )
    const deployOutput = deployResult.stdout + deployResult.stderr
    expect(deployResult.exitCode, `deploy failed:\n${deployOutput}`).toBe(0)

    // Step 3: Verify the version exists via versions list
    const listResult = await cli.exec(
      ['app', 'versions', 'list', '--path', appScaffold.appDir, '--json'],
      {timeout: 60 * 1000},
    )
    const listOutput = listResult.stdout + listResult.stderr
    expect(listResult.exitCode, `versions list failed:\n${listOutput}`).toBe(0)

    // Check that our version tag appears in the output
    const allOutput = listResult.stdout + listResult.stderr
    expect(allOutput).toContain(versionTag)
  })
})

import {appScaffoldFixture as test} from '../setup/app.js'
import {requireEnv} from '../setup/env.js'
import {expect} from '@playwright/test'
import {joinPath} from '@shopify/cli-kit/node/path'
import * as fs from 'fs'

test.describe('App basic flow (no extensions)', () => {
  test('init, dev, execute, quit, clean, deploy, versions, config link, deploy to secondary', async ({
    appScaffold,
    cli,
    env,
  }) => {
    // Full flow: init + dev (3 min) + deploy + config link + secondary deploy — needs 10 min
    test.setTimeout(10 * 60 * 1000)

    requireEnv(env, 'clientId', 'storeFqdn', 'secondaryClientId')

    // Step 1: Create a React Router app
    const initResult = await appScaffold.init({
      template: 'reactRouter',
      flavor: 'javascript',
      packageManager: 'npm',
    })
    expect(initResult.exitCode, `app init failed:\n${initResult.stdout}\n${initResult.stderr}`).toBe(0)

    // Step 2: Start dev server via PTY
    // Unset CI so keyboard shortcuts are enabled in the Dev UI
    const dev = await cli.spawn(['app', 'dev', '--path', appScaffold.appDir], {env: {CI: ''}})
    try {
      await dev.waitForOutput('Ready, watching for changes in your app', 3 * 60 * 1000)

      // Step 3: Run a GraphQL query while the dev server is running
      const executeResult = await cli.exec(
        ['app', 'execute', '--query', 'query { shop { name } }', '--path', appScaffold.appDir],
        {timeout: 60 * 1000},
      )
      const executeOutput = executeResult.stdout + executeResult.stderr
      expect(executeResult.exitCode, `app execute failed:\n${executeOutput}`).toBe(0)
      expect(executeOutput).toContain('shop')

      // Step 4: Press q to quit the dev server
      dev.sendKey('q')
      const devExitCode = await dev.waitForExit(30_000)
      expect(devExitCode).toBe(0)
    } finally {
      // Step 5: Always clean up the dev preview, even if the test fails
      dev.kill()
      const cleanResult = await cli.exec(['app', 'dev', 'clean', '--path', appScaffold.appDir])
      const cleanOutput = cleanResult.stdout + cleanResult.stderr
      expect(cleanResult.exitCode, `dev clean failed:\n${cleanOutput}`).toBe(0)
      expect(cleanOutput).toContain('Dev preview stopped')
    }

    // Step 6: Deploy the primary app
    const versionTag = `e2e-v-${Date.now()}`
    const deployResult = await cli.exec(
      [
        'app',
        'deploy',
        '--path',
        appScaffold.appDir,
        '--force',
        '--version',
        versionTag,
        '--message',
        'E2E basic flow deployment',
      ],
      {timeout: 5 * 60 * 1000},
    )
    const deployOutput = deployResult.stdout + deployResult.stderr
    expect(deployResult.exitCode, `deploy failed:\n${deployOutput}`).toBe(0)

    // Step 7: List versions and verify our tag appears
    const listResult = await cli.exec(['app', 'versions', 'list', '--path', appScaffold.appDir, '--json'], {
      timeout: 60 * 1000,
    })
    const listOutput = listResult.stdout + listResult.stderr
    expect(listResult.exitCode, `versions list failed:\n${listOutput}`).toBe(0)
    expect(listOutput).toContain(versionTag)

    // Step 8: Config link to the secondary app
    // Pre-create a minimal TOML stub so getTomls() finds the secondary client ID and skips
    // the interactive "Configuration file name" prompt entirely. This avoids PTY timing races
    // where the Enter key arrives before ink has fully initialized the text prompt, which
    // causes renderTextPrompt to return '' → filenameFromName('') = 'shopify.app.toml' →
    // that file already exists → overwrite confirmation prompt hangs.
    // (--config and --client-id are mutually exclusive flags, so we can't pass both directly.)
    fs.writeFileSync(
      joinPath(appScaffold.appDir, 'shopify.app.secondary.toml'),
      `client_id = "${env.secondaryClientId}"\n`,
    )

    const configLink = await cli.spawn(
      ['app', 'config', 'link', '--path', appScaffold.appDir, '--client-id', env.secondaryClientId],
      {env: {CI: '', SHOPIFY_FLAG_CLIENT_ID: undefined}},
    )
    await configLink.waitForOutput('is now linked to', 2 * 60 * 1000)
    const configLinkExitCode = await configLink.waitForExit(30_000)
    expect(configLinkExitCode, `config link failed:\n${configLink.getOutput()}`).toBe(0)

    // Step 9: Deploy to the secondary app using the linked config file
    const secondaryVersionTag = `e2e-secondary-v-${Date.now()}`
    const secondaryDeployResult = await cli.exec(
      [
        'app',
        'deploy',
        '--path',
        appScaffold.appDir,
        '--config',
        'secondary',
        '--force',
        '--version',
        secondaryVersionTag,
        '--message',
        'E2E secondary app deployment',
      ],
      {timeout: 5 * 60 * 1000, env: {SHOPIFY_FLAG_CLIENT_ID: undefined}},
    )
    const secondaryDeployOutput = secondaryDeployResult.stdout + secondaryDeployResult.stderr
    expect(secondaryDeployResult.exitCode, `secondary deploy failed:\n${secondaryDeployOutput}`).toBe(0)
  })
})

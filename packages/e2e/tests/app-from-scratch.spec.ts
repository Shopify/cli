import {freshAppScaffoldFixture as test} from '../setup/app.js'
import {requireEnv} from '../setup/env.js'
import {expect} from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path' // eslint-disable-line no-restricted-imports

test.describe('App basic flow — from scratch', () => {
  test('init, dev, execute, quit, clean, deploy, versions, config link, deploy to secondary', async ({
    appScaffold,
    cli,
    env,
  }) => {
    test.setTimeout(15 * 60 * 1000)
    requireEnv(env, 'storeFqdn', 'orgId')

    // Step 1: Create a new app (non-interactive via --organization-id + --name)
    const initResult = await appScaffold.init({
      template: 'reactRouter',
      flavor: 'typescript',
      packageManager: 'npm',
    })
    expect(initResult.exitCode, '‼️ Step 1 - app init failed').toBe(0)

    // Step 2: Start dev server (CI='' enables keyboard shortcuts)
    const dev = await cli.spawn(['app', 'dev', '--path', appScaffold.appDir], {env: {CI: ''}})
    try {
      await dev.waitForOutput('Ready, watching for changes in your app', 3 * 60 * 1000).catch((err: Error) => {
        throw new Error(`‼️ Step 2 - app dev failed\n${err.message}`)
      })

      // Step 3: Run a GraphQL query
      const executeResult = await cli.exec(
        ['app', 'execute', '--query', 'query { shop { name } }', '--path', appScaffold.appDir],
        {timeout: 60 * 1000},
      )
      const executeOutput = executeResult.stdout + executeResult.stderr
      expect(executeResult.exitCode, '‼️ Step 3 - app execute failed').toBe(0)
      expect(executeOutput, '‼️ Step 3 - app execute: response missing "shop" field').toContain('shop')

      // Step 4: Quit dev server
      dev.sendKey('q')
      const devExitCode = await dev.waitForExit(30_000).catch((err: Error) => {
        throw new Error(`‼️ Step 4 - app dev did not exit after pressing q\n${err.message}`)
      })
      expect(devExitCode, '‼️ Step 4 - app dev quit failed').toBe(0)
    } finally {
      // Step 5: Clean up dev preview (runs even if test fails)
      dev.kill()
      const cleanResult = await cli.exec(['app', 'dev', 'clean', '--path', appScaffold.appDir])
      const cleanOutput = cleanResult.stdout + cleanResult.stderr
      expect(cleanResult.exitCode, '‼️ Step 5 - app dev clean failed').toBe(0)
      expect(cleanOutput, '‼️ Step 5 - app dev clean: missing "Dev preview stopped" in output').toContain(
        'Dev preview stopped',
      )
    }

    // Step 6: Deploy
    const versionTag = `QA-E2E-1st-${Date.now()}`
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
    expect(deployResult.exitCode, '‼️ Step 6 - app deploy failed').toBe(0)

    // Step 7: Verify version appears in list
    const listResult = await cli.exec(['app', 'versions', 'list', '--path', appScaffold.appDir, '--json'], {
      timeout: 60 * 1000,
    })
    const listOutput = listResult.stdout + listResult.stderr
    expect(listResult.exitCode, '‼️ Step 7 - app versions list failed').toBe(0)
    expect(listOutput, `‼️ Step 7 - app versions list: missing version tag "${versionTag}"`).toContain(versionTag)

    // Step 8: Create a second app, then config link to it
    const secondaryAppName = `QA-E2E-2nd-${Date.now()}`
    const secondaryTmpDir = fs.mkdtempSync(path.join(appScaffold.appDir, '..', 'secondary-'))
    const secondaryInitResult = await cli.execCreateApp(
      [
        '--name',
        secondaryAppName,
        '--path',
        secondaryTmpDir,
        '--package-manager',
        'npm',
        '--local',
        '--template',
        'reactRouter',
        '--flavor',
        'typescript',
        '--organization-id',
        env.orgId,
      ],
      {env: {FORCE_COLOR: '0'}, timeout: 5 * 60 * 1000},
    )
    expect(secondaryInitResult.exitCode, '‼️ Step 8a - secondary app init failed').toBe(0)

    // Read client_id from the new app's toml
    const secondaryAppDir = fs
      .readdirSync(secondaryTmpDir, {withFileTypes: true})
      .find((entry) => entry.isDirectory() && fs.existsSync(path.join(secondaryTmpDir, entry.name, 'shopify.app.toml')))
    expect(secondaryAppDir, '‼️ Step 8a - secondary app dir not found').toBeTruthy()
    const secondaryToml = fs.readFileSync(
      path.join(secondaryTmpDir, secondaryAppDir!.name, 'shopify.app.toml'),
      'utf-8',
    )
    const clientIdMatch = secondaryToml.match(/client_id\s*=\s*"([^"]+)"/)
    expect(clientIdMatch, '‼️ Step 8a - client_id not found in secondary toml').toBeTruthy()
    const secondaryClientId = clientIdMatch![1]!

    // TOML stub so config link skips the "Configuration file name" prompt
    fs.writeFileSync(
      path.join(appScaffold.appDir, 'shopify.app.secondary.toml'),
      `client_id = "${secondaryClientId}"\n`,
    )

    // Link to the secondary app
    const configLinkResult = await cli.exec(
      ['app', 'config', 'link', '--path', appScaffold.appDir, '--client-id', secondaryClientId],
      {timeout: 2 * 60 * 1000},
    )
    expect(
      configLinkResult.exitCode,
      `‼️ Step 8b - app config link failed\nstdout: ${configLinkResult.stdout}\nstderr: ${configLinkResult.stderr}`,
    ).toBe(0)
    const configLinkOutput = configLinkResult.stdout + configLinkResult.stderr
    expect(configLinkOutput, '‼️ Step 8b - config link: missing "is now linked" in output').toContain(
      'is now linked to',
    )

    fs.rmSync(secondaryTmpDir, {recursive: true, force: true})

    // Step 9: Deploy to the secondary app
    const tomlFiles = fs
      .readdirSync(appScaffold.appDir)
      .filter(
        (file: string) => file.startsWith('shopify.app.') && file.endsWith('.toml') && file !== 'shopify.app.toml',
      )
    const secondaryConfig = tomlFiles[0]?.replace('shopify.app.', '').replace('.toml', '') ?? 'secondary'
    const secondaryVersionTag = `QA-E2E-2nd-${Date.now()}`
    const secondaryDeployResult = await cli.exec(
      [
        'app',
        'deploy',
        '--path',
        appScaffold.appDir,
        '--config',
        secondaryConfig,
        '--force',
        '--version',
        secondaryVersionTag,
        '--message',
        'E2E secondary app deployment',
      ],
      {timeout: 5 * 60 * 1000},
    )
    expect(secondaryDeployResult.exitCode, '‼️ Step 9 - app deploy (secondary) failed').toBe(0)
  })
})

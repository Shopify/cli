/* eslint-disable no-restricted-imports */
import {cliFixture as test} from '../setup/cli.js'
import {expect} from '@playwright/test'
import * as path from 'path'

test.describe('Hydrogen basic flow (mock shop)', () => {
  test('init, build, dev', async ({cli, env}) => {
    // No store credentials needed — uses mock.shop as data source
    test.setTimeout(10 * 60 * 1000)

    const hydrogenDir = path.join(env.tempDir, 'hydrogen-app')

    // Step 1: Scaffold and install dependencies via hydrogen init.
    // Force npm by overriding npm_config_user_agent (otherwise pnpm is detected
    // from the monorepo environment and used to install deps in the temp project).
    const initResult = await cli.exec(
      [
        'hydrogen',
        'init',
        '--path',
        hydrogenDir,
        '--mock-shop',
        '--language',
        'js',
        '--markets',
        'none',
        '--no-shortcut',
        '--no-git',
        '--install-deps',
        '--styling',
        'tailwind',
      ],
      {
        env: {npm_config_user_agent: 'npm'},
        timeout: 5 * 60 * 1000,
      },
    )
    const initOutput = initResult.stdout + initResult.stderr
    expect(initResult.exitCode, `hydrogen init failed:\n${initOutput}`).toBe(0)
    expect(initOutput).toContain('Storefront setup complete!')
    expect(initOutput).toContain('Mock.shop')

    // Step 2: Build for production
    const buildResult = await cli.exec(['hydrogen', 'build', '--path', hydrogenDir], {
      timeout: 3 * 60 * 1000,
    })
    const buildOutput = buildResult.stdout + buildResult.stderr
    expect(buildResult.exitCode, `hydrogen build failed:\n${buildOutput}`).toBe(0)

    // Step 3: Start dev server and verify it serves requests
    // fixed port to avoid conflicts
    const port = 14712
    const dev = await cli.spawn(['hydrogen', 'dev', '--path', hydrogenDir, '--port', String(port)], {
      env: {CI: ''},
    })
    try {
      await dev.waitForOutput('View Hydrogen app:', 3 * 60 * 1000)

      // eslint-disable-next-line no-restricted-globals
      const response = await fetch(`http://localhost:${port}/`)
      expect(response.status, `hydrogen dev server returned unexpected status`).toBe(200)
    } finally {
      dev.kill()
    }
  })
})

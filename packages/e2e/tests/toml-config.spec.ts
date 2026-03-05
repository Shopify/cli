/* eslint-disable no-console */
import {tomlAppFixture as test} from '../setup/toml-app.js'
import {requireEnv} from '../setup/env.js'
import {expect} from '@playwright/test'

test.describe('TOML config regression', () => {
  test('deploy succeeds with fully populated toml', async ({cli, env, tomlAppDir}) => {
    requireEnv(env, 'clientId')

    const result = await cli.exec(['app', 'deploy', '--path', tomlAppDir, '--force'], {
      timeout: 5 * 60 * 1000,
    })
    const output = result.stdout + result.stderr
    expect(result.exitCode, `deploy failed:\n${output}`).toBe(0)
  })

  test('dev starts with fully populated toml', async ({cli, env, tomlAppDir}) => {
    test.setTimeout(5 * 60 * 1000)
    requireEnv(env, 'clientId', 'storeFqdn')

    const proc = await cli.spawn(['app', 'dev', '--path', tomlAppDir], {
      env: {CI: ''},
    })

    try {
      await proc.waitForOutput('Ready, watching for changes in your app', 3 * 60 * 1000)

      const output = proc.getOutput()
      expect(output).toContain('q')

      proc.sendKey('q')
      const exitCode = await proc.waitForExit(30_000)
      expect(exitCode, `dev exited with non-zero code. Output:\n${proc.getOutput()}`).toBe(0)
    } catch (error) {
      const captured = proc.getOutput()
      console.error(`[toml-config dev] Captured PTY output:\n${captured}`)
      throw error
    } finally {
      proc.kill()
    }
  })
})

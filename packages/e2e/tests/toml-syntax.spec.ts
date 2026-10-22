/* eslint-disable no-restricted-imports */
import {cliFixture as test} from '../setup/cli.js'
import {expect} from '@playwright/test'
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import {join} from 'node:path'

test('deploy rejects malformed TOML without authentication', async ({cli, env}) => {
  const appDir = await mkdtemp(join(env.tempDir, 'invalid-toml-'))
  try {
    const toml = await readFile(new URL('../data/invalid-tomls/bad-syntax.toml', import.meta.url), 'utf8')
    await writeFile(join(appDir, 'shopify.app.toml'), toml)
    await writeFile(
      join(appDir, 'package.json'),
      JSON.stringify({name: 'invalid-toml', version: '1.0.0', private: true}),
    )

    const result = await cli.exec(['app', 'deploy', '--path', appDir, '--allow-updates', '--allow-deletes'])
    expect(result.exitCode).toBe(1)
    expect(result.stdout + result.stderr).toContain('Unterminated string')
  } finally {
    await rm(appDir, {recursive: true, force: true})
  }
})

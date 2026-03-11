/* eslint-disable no-console */
/* eslint-disable no-restricted-imports */
import {authFixture as test} from '../setup/auth.js'
import {requireEnv} from '../setup/env.js'
import {expect} from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import {fileURLToPath} from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const INVALID_TOMLS_DIR = path.join(__dirname, '../data/invalid-tomls')

const invalidTomls = fs.readdirSync(INVALID_TOMLS_DIR).filter((file) => file.endsWith('.toml'))

test.describe('TOML config invalid', () => {
  for (const tomlFile of invalidTomls) {
    const label = tomlFile.replace('.toml', '')

    test(`deploy rejects invalid toml: ${label}`, async ({cli, env}) => {
      requireEnv(env, 'clientId')

      // Set up temp dir with invalid toml + minimal package.json
      const appDir = fs.mkdtempSync(path.join(env.tempDir, `invalid-toml-${label}-`))
      try {
        const toml = fs
          .readFileSync(path.join(INVALID_TOMLS_DIR, tomlFile), 'utf8')
          .replace('__E2E_CLIENT_ID__', env.clientId)
        fs.writeFileSync(path.join(appDir, 'shopify.app.toml'), toml)
        fs.writeFileSync(
          path.join(appDir, 'package.json'),
          JSON.stringify({name: `invalid-${label}`, version: '1.0.0', private: true}),
        )

        const result = await cli.exec(['app', 'deploy', '--path', appDir, '--force'], {
          timeout: 2 * 60 * 1000,
        })
        const output = result.stdout + result.stderr
        console.log(`[${label}] exit code: ${result.exitCode}\n[${label}] output:\n${output}`)
        expect(result.exitCode, `expected deploy to fail for ${label}, but it succeeded:\n${output}`).not.toBe(0)
        expect(output.toLowerCase(), `expected error output for ${label}:\n${output}`).toMatch(/error|invalid|failed/)
      } finally {
        fs.rmSync(appDir, {recursive: true, force: true})
      }
    })
  }
})

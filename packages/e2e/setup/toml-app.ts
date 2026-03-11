/* eslint-disable no-restricted-imports */
import {authFixture} from './auth.js'
import * as path from 'path'
import * as fs from 'fs'
import {fileURLToPath} from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const FIXTURE_DIR = path.join(__dirname, '../data/valid-app')

/**
 * Test fixture that copies the full-toml fixture into a temp directory,
 * injects the real client_id, and exposes the path to tests.
 */
export const tomlAppFixture = authFixture.extend<{tomlAppDir: string}>({
  tomlAppDir: async ({env, authLogin: _authLogin}, use) => {
    const appDir = fs.mkdtempSync(path.join(env.tempDir, 'toml-app-'))

    // Copy fixture files
    for (const file of fs.readdirSync(FIXTURE_DIR)) {
      fs.copyFileSync(path.join(FIXTURE_DIR, file), path.join(appDir, file))
    }

    // Inject real client_id
    const tomlPath = path.join(appDir, 'shopify.app.toml')
    const toml = fs.readFileSync(tomlPath, 'utf8')
    fs.writeFileSync(tomlPath, toml.replace('__E2E_CLIENT_ID__', env.clientId))

    await use(appDir)

    fs.rmSync(appDir, {recursive: true, force: true})
  },
})

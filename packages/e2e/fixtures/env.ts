import {test as base} from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import {fileURLToPath} from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface E2EEnv {
  /** Partners token for API auth (empty string if not set) */
  partnersToken: string
  /** Primary test app client ID (empty string if not set) */
  clientId: string
  /** Dev store FQDN (e.g. cli-e2e-test.myshopify.com) */
  storeFqdn: string
  /** Secondary app client ID for config link tests */
  secondaryClientId: string
  /** Environment variables to pass to CLI processes */
  processEnv: NodeJS.ProcessEnv
  /** Temporary directory root for this worker */
  tempDir: string
}

export const directories = {
  root: path.resolve(__dirname, '../../..'),
  packages: {
    cli: path.resolve(__dirname, '../../../packages/cli'),
    app: path.resolve(__dirname, '../../../packages/app'),
    cliKit: path.resolve(__dirname, '../../../packages/cli-kit'),
  },
}

export const executables = {
  cli: path.resolve(__dirname, '../../../packages/cli/bin/run.js'),
  createApp: path.resolve(__dirname, '../../../packages/create-app/bin/run.js'),
}

/**
 * Creates an isolated temporary directory with XDG subdirectories and .npmrc.
 * Returns the temp directory path and the env vars to pass to child processes.
 */
export function createIsolatedEnv(baseDir: string): {tempDir: string; xdgEnv: Record<string, string>} {
  const tempDir = fs.mkdtempSync(path.join(baseDir, 'e2e-'))

  const xdgDirs = {
    XDG_DATA_HOME: path.join(tempDir, 'XDG_DATA_HOME'),
    XDG_CONFIG_HOME: path.join(tempDir, 'XDG_CONFIG_HOME'),
    XDG_STATE_HOME: path.join(tempDir, 'XDG_STATE_HOME'),
    XDG_CACHE_HOME: path.join(tempDir, 'XDG_CACHE_HOME'),
  }

  for (const dir of Object.values(xdgDirs)) {
    fs.mkdirSync(dir, {recursive: true})
  }

  // Write .npmrc to ensure package resolution works in CI
  fs.writeFileSync(path.join(tempDir, '.npmrc'), '//registry.npmjs.org/')

  return {tempDir, xdgEnv: xdgDirs}
}

/**
 * Asserts that a required environment variable is set.
 * Call this at the top of tests that need auth.
 */
export function requireEnv(env: E2EEnv, ...keys: (keyof Pick<E2EEnv, 'partnersToken' | 'clientId' | 'storeFqdn' | 'secondaryClientId'>)[]): void {
  for (const key of keys) {
    if (!env[key]) {
      const envVarNames: Record<string, string> = {
        partnersToken: 'SHOPIFY_CLI_PARTNERS_TOKEN',
        clientId: 'SHOPIFY_FLAG_CLIENT_ID',
        storeFqdn: 'E2E_STORE_FQDN',
        secondaryClientId: 'E2E_SECONDARY_CLIENT_ID',
      }
      throw new Error(`${envVarNames[key]} environment variable is required for this test`)
    }
  }
}

/**
 * Worker-scoped fixture providing auth tokens and environment configuration.
 * Auth tokens are optional — tests that need them should call requireEnv().
 */
export const envFixture = base.extend<{}, {env: E2EEnv}>({
  env: [
    async ({}, use) => {
      const partnersToken = process.env.SHOPIFY_CLI_PARTNERS_TOKEN ?? ''
      const clientId = process.env.SHOPIFY_FLAG_CLIENT_ID ?? ''
      const storeFqdn = process.env.E2E_STORE_FQDN ?? ''
      const secondaryClientId = process.env.E2E_SECONDARY_CLIENT_ID ?? ''

      const tmpBase = process.env.E2E_TEMP_DIR ?? path.join(directories.root, '.e2e-tmp')
      fs.mkdirSync(tmpBase, {recursive: true})

      const {tempDir, xdgEnv} = createIsolatedEnv(tmpBase)

      const processEnv: NodeJS.ProcessEnv = {
        ...process.env,
        ...xdgEnv,
        SHOPIFY_RUN_AS_USER: '0',
        NODE_OPTIONS: '',
        // Prevent interactive prompts
        CI: '1',
      }

      if (partnersToken) {
        processEnv.SHOPIFY_CLI_PARTNERS_TOKEN = partnersToken
      }
      if (clientId) {
        processEnv.SHOPIFY_FLAG_CLIENT_ID = clientId
      }
      if (storeFqdn) {
        processEnv.SHOPIFY_FLAG_STORE = storeFqdn
      }

      const env: E2EEnv = {
        partnersToken,
        clientId,
        storeFqdn,
        secondaryClientId,
        processEnv,
        tempDir,
      }

      await use(env)

      // Cleanup: remove temp directory
      fs.rmSync(tempDir, {recursive: true, force: true})
    },
    {scope: 'worker'},
  ],
})

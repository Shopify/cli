/**
 * Creates test apps in the authenticated org and prints their client IDs.
 * Run: npx tsx packages/e2e/scripts/create-test-apps.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {fileURLToPath} from 'url'
import {execa} from 'execa'
import {chromium} from '@playwright/test'
import stripAnsiModule from 'strip-ansi'
import {completeLogin} from '../helpers/browser-login.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../../..')
const cliPath = path.join(rootDir, 'packages/cli/bin/run.js')
const createAppPath = path.join(rootDir, 'packages/create-app/bin/run.js')

// Load .env
const envPath = path.join(__dirname, '../.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

const email = process.env.E2E_ACCOUNT_EMAIL
const password = process.env.E2E_ACCOUNT_PASSWORD
if (!email || !password) {
  console.error('E2E_ACCOUNT_EMAIL and E2E_ACCOUNT_PASSWORD must be set')
  process.exit(1)
}

const baseEnv: Record<string, string> = {
  ...process.env as Record<string, string>,
  NODE_OPTIONS: '',
  SHOPIFY_RUN_AS_USER: '0',
  FORCE_COLOR: '0',
}
delete baseEnv.SHOPIFY_CLI_PARTNERS_TOKEN
delete baseEnv.SHOPIFY_FLAG_CLIENT_ID
delete baseEnv.CI

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-create-apps-'))
  console.log(`Working directory: ${tmpDir}`)

  // Step 1: OAuth login
  console.log('\n--- Logging out ---')
  await execa('node', [cliPath, 'auth', 'logout'], {env: baseEnv, reject: false})

  console.log('\n--- Logging in via OAuth ---')
  await oauthLogin()
  console.log('Logged in successfully!')

  // Step 2: Create primary app via PTY (needs interactive prompts)
  console.log('\n--- Creating primary test app ---')
  const primaryClientId = await createAppInteractive(tmpDir, 'cli-e2e-primary')
  console.log(`Primary app client ID: ${primaryClientId}`)

  // Step 3: Create secondary app
  console.log('\n--- Creating secondary test app ---')
  const secondaryClientId = await createAppInteractive(tmpDir, 'cli-e2e-secondary')
  console.log(`Secondary app client ID: ${secondaryClientId}`)

  // Print summary
  console.log('\n========================================')
  console.log('Add these to your packages/e2e/.env:')
  console.log('========================================')
  console.log(`SHOPIFY_FLAG_CLIENT_ID=${primaryClientId}`)
  console.log(`E2E_SECONDARY_CLIENT_ID=${secondaryClientId}`)
  console.log('========================================')

  fs.rmSync(tmpDir, {recursive: true, force: true})
}

async function createAppInteractive(tmpDir: string, appName: string): Promise<string> {
  const appDir = path.join(tmpDir, appName)
  fs.mkdirSync(appDir)

  const nodePty = await import('node-pty')
  const pty = nodePty.spawn('node', [
    createAppPath,
    '--name', appName,
    '--path', appDir,
    '--template', 'none',
    '--package-manager', 'npm',
    '--local',
  ], {
    name: 'xterm-color', cols: 120, rows: 30, env: baseEnv,
  })

  let output = ''
  pty.onData((data: string) => {
    output += data
    process.stdout.write(data)
  })

  // Answer each interactive prompt as it appears
  const prompts = [
    'Which organization',
    'Create this project as a new app',
    'App name',
  ]
  for (const prompt of prompts) {
    try {
      await waitForText(() => output, prompt, 60_000)
      await sleep(500)
      pty.write('\r')
    } catch {
      // Prompt may not appear (e.g. single org skips selection)
      if (stripAnsiModule(output).includes('is ready for you to build')) break
    }
  }

  // Wait for completion
  await waitForText(() => output, 'is ready for you to build', 120_000)

  const exitCode = await new Promise<number>((resolve) => {
    pty.onExit(({exitCode}) => resolve(exitCode))
  })
  if (exitCode !== 0) throw new Error(`app init exited with code ${exitCode}`)

  // Find the app dir and extract client_id
  const entries = fs.readdirSync(appDir, {withFileTypes: true})
  const created = entries.find(
    (e) => e.isDirectory() && fs.existsSync(path.join(appDir, e.name, 'shopify.app.toml')),
  )
  if (!created) throw new Error(`No app directory found in ${appDir}`)

  const tomlPath = path.join(appDir, created.name, 'shopify.app.toml')
  const toml = fs.readFileSync(tomlPath, 'utf-8')
  const match = toml.match(/client_id\s*=\s*"([^"]+)"/)
  if (!match) throw new Error(`No client_id in ${tomlPath}`)

  return match[1]
}

async function oauthLogin() {
  const nodePty = await import('node-pty')
  const spawnEnv = {...baseEnv, BROWSER: 'none'}
  const pty = nodePty.spawn('node', [cliPath, 'auth', 'login'], {
    name: 'xterm-color', cols: 120, rows: 30, env: spawnEnv,
  })

  let output = ''
  pty.onData((data: string) => { output += data })

  await waitForText(() => output, 'Press any key to open the login page', 30_000)
  pty.write(' ')
  await waitForText(() => output, 'start the auth process', 10_000)

  const stripped = stripAnsiModule(output)
  const urlMatch = stripped.match(/https:\/\/accounts\.shopify\.com\S+/)
  if (!urlMatch) throw new Error(`No login URL found:\n${stripped}`)

  const browser = await chromium.launch({headless: false})
  const context = await browser.newContext({
    extraHTTPHeaders: {'X-Shopify-Loadtest-Bf8d22e7-120e-4b5b-906c-39ca9d5499a9': 'true'},
  })
  const page = await context.newPage()
  await completeLogin(page, urlMatch[0], email!, password!)

  await waitForText(() => output, 'Logged in', 60_000)
  try { pty.kill() } catch {}
  await browser.close()
}

function waitForText(getOutput: () => string, text: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (stripAnsiModule(getOutput()).includes(text) || getOutput().includes(text)) {
        clearInterval(interval)
        clearTimeout(timer)
        resolve()
      }
    }, 200)
    const timer = setTimeout(() => {
      clearInterval(interval)
      reject(new Error(`Timed out waiting for: "${text}"\nOutput:\n${stripAnsiModule(getOutput())}`))
    }, timeoutMs)
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

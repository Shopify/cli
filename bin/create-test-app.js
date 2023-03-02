#!/usr/bin/env node

import os from 'os'
import path from 'path'
import fs from 'fs'
import execa from 'execa'
import {Readable} from 'stream'
import {fileURLToPath} from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const homeDir = os.homedir()
const today = new Date().toISOString().split('T')[0]
const appName = `nightly-app-${today}`
const appPath = path.join(homeDir, 'Desktop', appName)

if (!fs.existsSync(appPath)) {
  log('Creating a new app using nightly...')
  await execa(
    'pnpm',
    [
      'create',
      '@shopify/app@nightly',
      '--template=node',
      `--name=${appName}`,
      `--path=${path.join(homeDir, 'Desktop')}`,
    ],
    {stdio: 'inherit'},
  )

  log('Running the app...')
  await appExec('pnpm', ['install'])
  await pnpmDev()
}

if (!fs.existsSync(path.join(appPath, 'extensions', 'sub-ui-ext'))) {
  log('Generating UI extension...')
  await appExec('pnpm', [
    'generate',
    'extension',
    '--type=subscription_ui',
    '--name=sub-ui-ext',
    '--template=vanilla-js',
  ])
  await pnpmDev()
}

if (!fs.existsSync(path.join(appPath, 'extensions', 'theme-app-ext'))) {
  log('Generating Theme App extension...')
  await appExec('pnpm', ['generate', 'extension', '--type=theme_app_extension', '--name=theme-app-ext'])
  const fixtureAppTheme = path.join(__dirname, '..', 'fixtures', 'app', 'extensions', 'theme-extension')
  const filesToCopy = [
    path.join('blocks', 'star_rating.liquid'),
    path.join('snippets', 'stars.liquid'),
    path.join('assets', 'thumbs-up.png'),
    path.join('locales', 'en.default.json'),
  ]
  filesToCopy.forEach((file) => {
    fs.copyFileSync(path.join(fixtureAppTheme, file), path.join(appPath, 'extensions', 'theme-app-ext', file))
  })
  await pnpmDev()
}

if (!fs.existsSync(path.join(appPath, 'extensions', 'prod-discount-fun'))) {
  log('Generating JS function...')
  const functionDir = path.join(appPath, 'extensions', 'prod-discount-fun')
  await appExec(
    'pnpm',
    ['generate', 'extension', '--type=product_discounts', '--name=prod-discount-fun', '--template=typescript'],
    {env: {SHOPIFY_CLI_FUNCTIONS_JAVASCRIPT: '1'}},
  )
  await appExec('pnpm', ['build'], {cwd: functionDir})
  const previewProcess = execa('pnpm', ['preview'], {cwd: functionDir, stdout: 'inherit'})
  Readable.from(['{"discountNode":{"metafield":null}}']).pipe(previewProcess.stdin)
  await previewProcess
}

log('All done! 🎉')

// helpers
function log(message) {
  console.log(`\r\n🧪 ${message}`)
}

async function appExec(command, args, options = {}) {
  const defaults = {cwd: appPath, stdio: 'inherit'}
  await execa(command, args, {...defaults, ...options})
}

async function pnpmDev() {
  try {
    await appExec(`cd ${appPath} && pnpm run dev`, [], {shell: true})
  } catch (error) {}
}

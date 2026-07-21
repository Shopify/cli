import {spawnSync} from 'node:child_process'
import {existsSync} from 'node:fs'
import {fileURLToPath} from 'node:url'

const cliPath = fileURLToPath(new URL('./run.js', import.meta.url))
const compiledCliPath = fileURLToPath(new URL('../dist/bootstrap.js', import.meta.url))

if (existsSync(compiledCliPath)) {
  const installation = spawnSync(process.execPath, [cliPath, 'skill', 'install'], {stdio: 'inherit'})

  if (installation.error || installation.status !== 0) {
    console.warn('The Shopify skill was not installed. Run `shopify skill install` to try again.')
  }
}

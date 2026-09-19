/* eslint-disable no-restricted-imports, import-x/order */
import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {build} from 'esbuild'
import {describe, expect, test} from 'vitest'

const packageRoot = resolve(__dirname, '..')
const entry = resolve(packageRoot, 'dist/index.js')

function buildPackage() {
  execFileSync('pnpm', ['exec', 'nx', 'build', 'dev-platform-auth'], {
    cwd: resolve(packageRoot, '../..'),
    stdio: 'ignore',
  })
}

describe('package portability', () => {
  test('can be consumed by plain JavaScript', () => {
    buildPackage()
    execFileSync(process.execPath, [resolve(packageRoot, 'tests/consumer.mjs')], {stdio: 'pipe'})
  })

  test('does not include Node built-ins or CommonJS in the portable entry', () => {
    buildPackage()
    const output = readFileSync(entry, 'utf8')
    const nodeBuiltins =
      /(?:node:)?(?:assert|buffer|child_process|cluster|crypto|dgram|dns|events|fs|http|https|module|net|os|path|perf_hooks|process|querystring|readline|stream|string_decoder|timers|tls|tty|url|util|v8|vm|worker_threads|zlib)/

    expect(output).not.toMatch(nodeBuiltins)
    expect(output).not.toContain('require(')
  })

  test('bundles for browsers without external dependencies', async () => {
    buildPackage()
    await expect(build({entryPoints: [entry], bundle: true, platform: 'browser', write: false})).resolves.toBeDefined()
  })
})

import * as system from './system'
import {Fatal} from './error'
import {join} from './path'
// eslint-disable-next-line no-restricted-imports
import {spawn} from 'child_process'
import constants from '$constants'

export async function exec(args: string[], token: string) {
  await validateRubyEnv()
  await installCLIIfNeeded()

  const allArgs = ['exec', 'shopify'].concat(args)
  spawn('bundle', allArgs, {
    stdio: 'inherit',
    shell: true,
  })
}

export async function validateRubyEnv() {
  try {
    await system.exec('ruby', ['-v'])
  } catch {
    throw new Fatal(
      'Ruby environment not found',
      'Make sure you have ruby installed on your system: https://www.ruby-lang.org/en/documentation/installation/',
    )
  }

  try {
    await system.exec('bundler', ['-v'])
  } catch {
    throw new Fatal('Bundler not found', 'Make sure you have Bundler installed on your system: https://bundler.io/')
  }
}

async function installCLIIfNeeded() {
  const version = '0.12'
  const dir = join(constants.paths.directories.cache.vendor.path(), 'ruby-cli', version)
  console.log(dir)
  await system.exec('bundle', ['config', 'set', '--local', 'path', dir])
  await system.exec('bundle', ['install'])
}

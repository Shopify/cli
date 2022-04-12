import * as system from './system'
import {Fatal} from './error'
import {spawn} from 'child_process'

export async function exec(args: string[], token: string) {
  await validateRubyEnv()
  await installCLIIfNeeded()
  // PENDING: Call the ruby CLI once integrated
  // await concurrent(0, 'themes', async (stdout) => {
  //   try {
  const allArgs = ['exec', 'shopify'].concat(args)
  // await system.exec('bundle', allArgs, {stdout, env: {...process.env, SHOPIFY_ADMIN_TOKEN: token}})
  const op = spawn('bundle', allArgs, {
    stdio: 'inherit',
    shell: true,
  })
  // op.on('message', (message, sendHandle) => {
  //   console.log('message', message, sendHandle)
  // })
  // op.stdout.on('data', (data) => {
  //   console.log(`stdout: ${data}`)
  //   // if (data && typeof data.toString === 'function') {
  //   //   // result = data.toString()
  //   // }
  // })

  // op.on('close', (code, ...args) => {
  //   console.log(`child process exited with code ${code}`, args)
  // })
  // } catch (error: any) {
  //   throw new Fatal(`Command "${error.command}" failed\n${error.stderr}`)
  // }
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
  await system.exec('bundle', ['config', 'set', '--local', 'path', `~/.shopify-cli/${version}`])
  await system.exec('bundle', ['install'])
}

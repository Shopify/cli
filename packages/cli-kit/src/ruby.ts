import {Fatal} from '$error'
import {system} from '$index'
import {concurrent} from '$output'

export async function exec(args: string[], token: string) {
  await validateRubyEnv()
  // PENDING: Call the ruby CLI once integrated
  await concurrent(0, 'themes', async (stdout) => {
    try {
      await system.exec('ruby', args, {stdout, env: {...process.env, SHOPIFY_ADMIN_TOKEN: token}})
    } catch (error: any) {
      throw new Fatal(`Command "${error.command}" failed\n${error.stderr}`)
    }
  })
}

async function validateRubyEnv() {
  try {
    await system.exec('ruby', ['-v'])
  } catch (error) {
    throw new Fatal(
      'Ruby environment not found',
      'Make sure you have ruby installed on your system: https://www.ruby-lang.org/en/documentation/installation/',
    )
  }
}

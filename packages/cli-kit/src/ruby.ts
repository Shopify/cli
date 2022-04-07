import {Fatal} from '$error'
import {system} from '$index'
import {concurrent} from '$output'

export async function exec(args: string[], token: string) {
  await validateRubyEnv()
  await concurrent(0, 'ruby', async (stdout) => {
    try {
      await system.exec('ruby', args, {stdout, env: {...process.env, SHOPIFY_ADMIN_TOKEN: token}})
    } catch (error: any) {
      throw new Fatal(`Ruby command "${error.command}" failed\n${error.stderr}`)
    }
  })
}

async function validateRubyEnv() {
  try {
    await system.exec('ruby', ['-v'])
  } catch (error) {
    throw new Fatal('Ruby environment not found')
  }
}

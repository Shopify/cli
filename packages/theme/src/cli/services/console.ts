import {isStorefrontPasswordProtected} from '../utilities/theme-environment/storefront-session.js'
import {consoleLog} from '@shopify/cli-kit/node/output'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {createInterface} from 'readline'

export async function ensureReplEnv(store: string) {
  const storefrontHasPassword = await isStorefrontPasswordProtected(store)
  consoleLog(storefrontHasPassword.toString())
  if (storefrontHasPassword) {
    const password = await promptPassword()
    consoleLog(password)
  }
}

export async function repl(_adminSession: AdminSession, _storefrontToken: string, _password?: string) {}

function promptPassword(): Promise<string> {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    readline.question('Enter your theme password: ', (password) => {
      resolve(password)
    })
  })
}

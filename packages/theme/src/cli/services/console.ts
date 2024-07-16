import {
  isStorefrontPasswordProtected,
  isStorefrontPasswordCorrect,
} from '../utilities/theme-environment/storefront-session.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {renderTextPrompt} from '@shopify/cli-kit/node/ui'

export async function ensureReplEnv(store: string, storePasswordFlag?: string) {
  const themeId = await findOrCreateReplTheme()

  const storePassword = (await isStorefrontPasswordProtected(store))
    ? await promptValidPassword(storePasswordFlag, store)
    : storePasswordFlag

  return {
    themeId,
    storePassword,
  }
}

async function promptValidPassword(password: string | undefined, store: string) {
  let finalPassword = password || (await promptPassword('Enter your theme password'))

  // eslint-disable-next-line no-await-in-loop
  while (!(await isStorefrontPasswordCorrect(finalPassword, store))) {
    // eslint-disable-next-line no-await-in-loop
    finalPassword = await promptPassword('Incorrect password provided. Please try again')
  }
  return finalPassword
}

async function findOrCreateReplTheme(): Promise<string> {
  return ''
}

export async function repl(
  _adminSession: AdminSession,
  _storefrontToken: string,
  _themeId: string,
  _password: string | undefined,
) {}

async function promptPassword(prompt: string): Promise<string> {
  return renderTextPrompt({
    message: prompt,
    password: true,
  })
}

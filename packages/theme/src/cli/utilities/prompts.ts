import {isStorefrontPasswordCorrect} from './theme-environment/storefront-session.js'
import {renderTextPrompt} from '@shopify/cli-kit/node/ui'

export async function ensureValidPassword(password: string | undefined, store: string) {
  let finalPassword = password || (await promptPassword('Enter your theme password'))

  // eslint-disable-next-line no-await-in-loop
  while (!(await isStorefrontPasswordCorrect(finalPassword, store))) {
    // eslint-disable-next-line no-await-in-loop
    finalPassword = await promptPassword('Incorrect password provided. Please try again')
  }
  return finalPassword
}

async function promptPassword(prompt: string): Promise<string> {
  return renderTextPrompt({
    message: prompt,
    password: true,
  })
}

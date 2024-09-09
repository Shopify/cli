import {isStorefrontPasswordCorrect} from './storefront-session.js'
import {getStorefrontPassword, removeStorefrontPassword, setStorefrontPassword} from '../../services/local-storage.js'
import {renderTextPrompt} from '@shopify/cli-kit/node/ui'

export async function ensureValidPassword(password: string | undefined, store: string) {
  let finalPassword = password || getStorefrontPassword() || (await promptPassword('Enter your store password'))
  let isPasswordRemoved = false

  // eslint-disable-next-line no-await-in-loop
  while (!(await isStorefrontPasswordCorrect(finalPassword, store))) {
    if (!isPasswordRemoved) {
      removeStorefrontPassword()
      isPasswordRemoved = true
    }
    // eslint-disable-next-line no-await-in-loop
    finalPassword = await promptPassword('Incorrect password provided. Please try again')
  }

  setStorefrontPassword(finalPassword)
  return finalPassword
}

async function promptPassword(prompt: string): Promise<string> {
  return renderTextPrompt({
    message: prompt,
    password: true,
  })
}

import {isStorefrontPasswordCorrect} from './storefront-session.js'
import {
  getStorefrontPassword,
  getThemeStore,
  removeStorefrontPassword,
  setStorefrontPassword,
} from '../../services/local-storage.js'
import {ensureThemeStore} from '../theme-store.js'
import {renderTextPrompt, TokenItem} from '@shopify/cli-kit/node/ui'
import {storePasswordPage} from '@shopify/cli-kit/node/themes/urls'

export async function ensureValidPassword(password: string | undefined, store: string) {
  /*
   * This allows us to call ensureValidPassword() in other packages
   * without the need to explicitly import and call ensureThemeStore() upstream
   */
  if (!getThemeStore()) {
    ensureThemeStore({store})
  }

  let finalPassword =
    password ||
    getStorefrontPassword() ||
    (await promptPassword([
      'Enter your',
      {
        link: {
          label: 'store password',
          url: storePasswordPage(store),
        },
      },
    ]))
  let isPasswordRemoved = false

  // eslint-disable-next-line no-await-in-loop
  while (!(await isStorefrontPasswordCorrect(finalPassword, store))) {
    if (!isPasswordRemoved) {
      removeStorefrontPassword()
      isPasswordRemoved = true
    }
    // eslint-disable-next-line no-await-in-loop
    finalPassword = await promptPassword([
      'Incorrect',
      {
        link: {
          label: 'store password',
          url: storePasswordPage(store),
        },
      },
      {
        char: '.',
      },
      'Please try again',
    ])
  }

  setStorefrontPassword(finalPassword)
  return finalPassword
}

async function promptPassword(prompt: TokenItem): Promise<string> {
  return renderTextPrompt({
    message: prompt,
    password: true,
  })
}

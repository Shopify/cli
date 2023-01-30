import {themeFlags} from '../flags.js'
import {getCachedThemeStore, setCachedThemeStore} from '../services/conf.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'

export function getThemeStore(flags: {store: string | undefined}): string {
  const store = flags.store || getCachedThemeStore()
  if (!store) {
    throw new AbortError(
      'A store is required',
      `Specify the store passing ${
        outputContent`${outputToken.genericShellCommand(`--${themeFlags.store.name}={your_store_url}`)}`.value
      } or set the ${
        outputContent`${outputToken.genericShellCommand(themeFlags.store.env as string)}`.value
      } environment variable.`,
    )
  }
  setCachedThemeStore(store)
  return store
}

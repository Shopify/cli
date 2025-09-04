import {themeFlags} from '../flags.js'
import {getThemeStore, setThemeStore} from '../services/local-storage.js'
import {recordError} from '@shopify/cli-kit/node/analytics'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'

export function ensureThemeStore(flags: {store: string | undefined}): string {
  const store = flags.store ?? getThemeStore()
  if (!store) {
    throw recordError(
      new AbortError(
        'A store is required',
        `Specify the store passing ${
          outputContent`${outputToken.genericShellCommand(`--${themeFlags.store.name}=example.myshopify.com`)}`.value
        } or set the ${
          outputContent`${outputToken.genericShellCommand(themeFlags.store.env as string)}`.value
        } environment variable.`,
      ),
    )
  }
  setThemeStore(store)
  return store
}

import {themeFlags} from '../flags.js'
import {getThemeStore, setThemeStore} from '../services/local-storage.js'
import {AbortError} from '@shopify/cli-kit/node/error'

export function ensureThemeStore(flags: {store: string | undefined}): string {
  const store = flags.store || getThemeStore()
  if (!store) {
    throw new AbortError('A store is required', [
      'Specify the store passing ',
      {command: `--${themeFlags.store.name}={your_store_url}`},
      ' or set the ',
      {command: themeFlags.store.env as string},
      ' environment variable.',
    ])
  }
  setThemeStore(store)
  return store
}

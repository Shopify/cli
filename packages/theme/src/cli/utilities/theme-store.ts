import {themeFlags} from '../flags.js'
import {themeConf} from '../services/conf.js'
import {output} from '@shopify/cli-kit'
import {AbortError} from '@shopify/cli-kit/node/error'

export function getThemeStore(flags: {store: string | undefined}): string {
  const store = flags.store || themeConf().get('themeStore')
  if (!store) {
    throw new AbortError(
      'A store is required',
      `Specify the store passing ${
        output.content`${output.token.genericShellCommand(`--${themeFlags.store.name}={your_store_url}`)}`.value
      } or set the ${
        output.content`${output.token.genericShellCommand(themeFlags.store.env as string)}`.value
      } environment variable.`,
    )
  }
  themeConf().set('themeStore', store)
  return store
}

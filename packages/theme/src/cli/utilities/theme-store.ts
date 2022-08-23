import {themeFlags} from '../flags.js'
import {store as conf, error, output} from '@shopify/cli-kit'

export function getTheme(flags: {store: string | undefined}): string {
  const store = flags.store || conf.cliKitStore().getTheme()
  if (!store) {
    throw new error.Abort(
      'A store is required',
      `Specify the store passing ${
        output.content`${output.token.genericShellCommand(`--${themeFlags.store.name}={your_store_url}`)}`.value
      } or set the ${
        output.content`${output.token.genericShellCommand(themeFlags.store.env as string)}`.value
      } environment variable.`,
    )
  }
  conf.cliKitStore().setTheme(store)
  return store
}

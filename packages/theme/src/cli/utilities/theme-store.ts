import {themeFlags} from '../flags.js'
import {output} from '@shopify/cli-kit'
import {AbortError} from '@shopify/cli-kit/node/error'
import {Conf} from '@shopify/cli-kit/node/store'

export function getThemeStore(flags: {store: string | undefined}, config: Conf<ThemeConfSchema> = themeConf()): string {
  const store = flags.store || config.get('themeStore')
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
  config.set('themeStore', store)
  return store
}

export interface ThemeConfSchema {
  themeStore: string
}

let _instance: Conf<ThemeConfSchema> | undefined

function themeConf() {
  if (!_instance) {
    _instance = new Conf<ThemeConfSchema>({projectName: 'shopify-cli-theme-conf'})
  }
  return _instance
}

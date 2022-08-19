import {store as conf, error} from '@shopify/cli-kit'

export function getTheme(flags: {store: string | undefined}): string {
  const store = flags.store || conf.cliKitStore().getTheme()
  if (!store) {
    throw new error.Abort(
      'A store is required',
      'Specify the store passing --store={your_store_url} or set the SHOPIFY_FLAG_STORE environment variable.',
    )
  }
  conf.cliKitStore().setTheme(store)
  return store
}

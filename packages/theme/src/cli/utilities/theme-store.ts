import {store as conf, error} from '@shopify/cli-kit'

export async function getTheme(flags: {store: string | undefined}): Promise<string> {
  const store = flags.store || (await conf.getTheme())
  if (!store) {
    throw new error.Abort('A store is required', 'Specify the store using --store={your_store}')
  }
  await conf.setTheme(store)
  return store
}

import {fetchStoreThemes} from './theme-selector/fetch.js'
import {Filter, FilterProps, filterThemes} from './theme-selector/filter.js'
import {session} from '@shopify/cli-kit'
import * as uix from '@shopify/cli-kit/node/ui'

type AdminSession = session.AdminSession

/**
 * Finds or selects a theme in the store.
 *
 * @param session - current Admin session
 * @param options - {@link Options}
 *
 * @returns the selected {@link Theme}
 */
export async function findOrSelectTheme(session: AdminSession, opts: {header: string; filter: FilterProps}) {
  const themes = await fetchStoreThemes(session)
  const filter = new Filter(opts.filter)
  const store = session.storeFqdn

  if (filter.any()) {
    return filterThemes(store, themes, filter)[0]!
  }

  const message = opts.header
  const choices = themes.map((theme) => {
    return {
      value: theme,
      label: `${theme.name} [${theme.role}]`,
    }
  })

  return uix.renderPrompt({
    message,
    choices,
  })
}

/**
 * Finds themes in the store.
 *
 * @param session - current Admin session
 * @param identifiers - list of identifiers
 *
 * @returns a collection of {@link Theme}
 */
export async function findThemes(session: AdminSession, filterProps: FilterProps) {
  const themes = await fetchStoreThemes(session)
  const filter = new Filter(filterProps)
  const store = session.storeFqdn

  if (filter.any()) {
    return filterThemes(store, themes, filter)
  }

  return []
}

import {fetchStoreThemes} from './theme-selector/fetch.js'
import {Filter, FilterProps, filterThemes} from './theme-selector/filter.js'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import {AdminSession} from '@shopify/cli-kit/node/session'

/**
 * Finds or selects a theme in the store.
 *
 * @param session - Current Admin session
 * @param options - Options to select a theme:
 *  - header: the header presented when users select a theme
 *  - filter: the filter ({@link FilterProps}) applied in the list
 *            of themes in the store
 *
 * @returns the selected {@link Theme}
 */
export async function findOrSelectTheme(session: AdminSession, options: {header: string; filter: FilterProps}) {
  const themes = await fetchStoreThemes(session)
  const filter = new Filter(options.filter)
  const store = session.storeFqdn

  if (filter.any()) {
    return filterThemes(store, themes, filter)[0]!
  }

  return renderSelectPrompt({
    message: options.header,
    choices: themes.map((theme) => {
      return {
        value: theme,
        label: `${theme.name} [${theme.role}]`,
      }
    }),
  })
}

/**
 * Finds themes in the store.
 *
 * @param session - Current Admin session
 * @param filterProps - The filter ({@link FilterProps}) applied in the list
 *                      of themes in the store
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

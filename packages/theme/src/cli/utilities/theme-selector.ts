import {fetchStoreThemes} from './theme-selector/fetch.js'
import {Filter, FilterProps, filterThemes} from './theme-selector/filter.js'
import {getDevelopmentTheme} from '../services/local-storage.js'
import {renderAutocompletePrompt} from '@shopify/cli-kit/node/ui'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {capitalize} from '@shopify/cli-kit/common/string'
import {themeCreate} from '@shopify/cli-kit/node/themes/api'
import {promptThemeName, UNPUBLISHED_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {AbortError} from '@shopify/cli-kit/node/error'
import {Theme} from '@shopify/cli-kit/node/themes/types'

/**
 * Options to find or select a theme.
 */
interface FindOrSelectOptions {
  /**
   * When 'true', the selector renders with an option to create a new theme.
   */
  create?: boolean
  /**
   * The header presented when users select a theme.
   */
  header?: string
  /**
   * The filter applied in the list of themes in the store.
   */
  filter: FilterProps
}

/**
 * Finds or selects a theme in the store.
 *
 * @param session - Current Admin session
 * @param options - Options to select a theme
 * @returns the selected {@link Theme}
 */
export async function findOrSelectTheme(session: AdminSession, options: FindOrSelectOptions) {
  const themes = await fetchStoreThemes(session)
  const filter = new Filter(options.filter)
  const store = session.storeFqdn

  if (filter.any()) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return filterThemes(store, themes, filter)[0]!
  }

  const message = options.header ?? ''
  const choices = themes.map((theme) => {
    const yoursLabel = theme.id.toString() === getDevelopmentTheme() ? ' [yours]' : ''

    return {
      value: async () => theme,
      label: `${theme.name}${yoursLabel}`,
      group: capitalize(theme.role),
    }
  })

  if (options.create) {
    choices.unshift(newThemeOption(session))
  }

  const themeSupplier = await renderAutocompletePrompt({
    message,
    choices,
  })

  return themeSupplier()
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

export function newThemeOption(session: AdminSession): {
  value: () => Promise<Theme>
  label: string
  group: string
} {
  return {
    value: async () => {
      const role = UNPUBLISHED_THEME_ROLE
      const name = await promptThemeName('Name of the new theme')
      const theme = await themeCreate({name, role}, session)

      if (!theme) {
        throw new AbortError('The theme could not be created.')
      }

      return theme
    },
    label: '[Create a new theme]',
    group: capitalize(UNPUBLISHED_THEME_ROLE),
  }
}

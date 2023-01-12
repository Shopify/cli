import {Theme} from '../../models/theme.js'
import {error} from '@shopify/cli-kit'

export function filterThemes(store: string, themes: Theme[], filter: Filter): Theme[] {
  return filterByRole(store, themes, filter) || filterByTheme(store, themes, filter)
}

function filterByRole(store: string, themes: Theme[], filter: Filter) {
  const role = filter.role

  if (!role) {
    return
  }

  const error = `The ${store} store doesn't have a theme with the "${role}" role`

  return [
    find(themes, (theme) => {
      return theme.role === role
    }).orThrow(error),
  ]
}

function filterByTheme(store: string, themes: Theme[], filter: Filter) {
  const identifiers = filter.themeIdentifiers

  return identifiers.map((identifier) => {
    const error = `The ${store} store doesn't have a theme with the "${identifier}" ID or name`

    return find(themes, (theme) => {
      return [`${theme.id}`, theme.name].includes(identifier)
    }).orThrow(error)
  })
}

function find(themes: Theme[], predicate: (theme: Theme) => boolean): {orThrow: (error: string) => Theme | never} {
  const theme = themes.find(predicate)

  if (theme) {
    return {orThrow: (_errorMessage: string) => theme}
  }

  return {
    orThrow: (errorMessage: string) => {
      throw new error.Abort(errorMessage)
    },
  }
}

/**
 * {@link Theme} ID or name
 */
export type ThemeIdentifier = string

export interface FilterProps {
  themes?: ThemeIdentifier[]
  theme?: ThemeIdentifier
  development?: boolean
  live?: boolean
}

export class Filter {
  constructor(public queryProps: FilterProps) {}

  get role() {
    if (this.queryProps.live) {
      return 'live'
    }
    if (this.queryProps.development) {
      return 'development'
    }
  }

  get themeIdentifiers() {
    const identifiers = [this.queryProps.theme, this.queryProps.themes]

    return identifiers.flat().filter((i): i is string => Boolean(i))
  }

  any() {
    return Object.values(this.queryProps).some(Boolean)
  }
}

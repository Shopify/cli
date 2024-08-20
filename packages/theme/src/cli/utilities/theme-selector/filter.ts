import {ALLOWED_ROLES} from './fetch.js'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {AbortError} from '@shopify/cli-kit/node/error'

export function filterThemes(store: string, themes: Theme[], filter: Filter): Theme[] {
  return filterByRole(store, themes, filter) || filterByTheme(store, themes, filter)
}

function filterByRole(store: string, themes: Theme[], filter: Filter) {
  const role = filter.role

  if (!role) {
    return
  }

  const error = `No themes on the store ${store} match the role "${role}"`

  return filterArray(themes, (theme) => {
    return theme.role === role
  }).orThrow(error)
}

function filterByTheme(store: string, themes: Theme[], filter: Filter) {
  const identifiers = filter.themeIdentifiers

  return identifiers.flatMap((identifier) => {
    const error = `No themes on the store ${store} match the ID or name "${identifier}"`

    return filterArray(themes, (theme) => {
      if (`${theme.id}` === identifier) {
        return true
      }

      if (theme.name.toLowerCase() === identifier.toLowerCase()) {
        return true
      }

      return isPartialMatch(theme.name.toLowerCase(), identifier.toLowerCase())
    }).orThrow(error)
  })
}

function filterArray(
  themes: Theme[],
  predicate: (theme: Theme) => boolean,
): {orThrow: (error: string) => Theme[] | never} {
  const filteredThemes = themes.filter(predicate)

  if (filteredThemes.length > 0) {
    return {orThrow: (_errorMessage: string) => filteredThemes}
  }

  return {
    orThrow: (errorMessage: string) => {
      throw new AbortError(errorMessage)
    },
  }
}

/**
 * {@link Theme} ID or name
 */
type ThemeIdentifier = string

export interface FilterProps {
  themes?: ThemeIdentifier[]
  theme?: ThemeIdentifier
  development?: boolean
  live?: boolean
  unpublished?: boolean
}

export class Filter {
  constructor(public queryProps: FilterProps) {}

  get role() {
    for (const role of ALLOWED_ROLES) {
      if (this.queryProps[role]) {
        return role
      }
    }
  }

  get themeIdentifiers() {
    const identifiers = [this.queryProps.theme, this.queryProps.themes]

    return identifiers.flat().filter((i): i is string => Boolean(i))
  }

  any() {
    return Object.values(this.queryProps).some((val) => {
      if (val?.length !== undefined) {
        return val.length > 0
      }

      return Boolean(val)
    })
  }
}

function isPartialMatch(themeName: string, identifier: string): boolean {
  const trimmedIdentifier = identifier.replace(/(^\*)|(\*$)/g, '')

  if (identifier.startsWith('*') && identifier.endsWith('*')) {
    return themeName.includes(trimmedIdentifier)
  }

  if (identifier.startsWith('*')) {
    return themeName.endsWith(trimmedIdentifier)
  }

  if (identifier.endsWith('*')) {
    return themeName.startsWith(trimmedIdentifier)
  }

  return false
}

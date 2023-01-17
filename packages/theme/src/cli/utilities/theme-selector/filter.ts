import {ALLOWED_ROLES} from './fetch.js'
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

  return filterArray(themes, (theme) => {
    return theme.role === role
  }).orThrow(error)
}

function filterByTheme(store: string, themes: Theme[], filter: Filter) {
  const identifiers = filter.themeIdentifiers

  return identifiers.flatMap((identifier) => {
    const error = `The ${store} store doesn't have a theme with the "${identifier}" ID or name`

    return filterArray(themes, (theme) => {
      return `${theme.id}` === identifier || new RegExp(identifier, 'i').test(theme.name)
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

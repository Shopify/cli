import {error} from '@shopify/cli-kit'

export function pluralized<T>(items: T[], options: {singular: (item: T) => string; plural: (items: T[]) => string}) {
  if (items.length === 1) {
    return options.singular(items[0]!)
  }

  if (items.length > 1) {
    return options.plural(items)
  }

  // Unexpected error
  throw new error.AbortSilent()
}

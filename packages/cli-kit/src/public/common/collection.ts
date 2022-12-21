import {ValueIteratee} from 'lodash'
import {createRequire} from 'node:module'

const require = createRequire(import.meta.url)

export function groupBy<T>(
  collection: ArrayLike<T> | null | undefined,
  iteratee?: ValueIteratee<T>,
): {
  [index: string]: T[]
} {
  const lodashBroupBy = require('lodash/groupBy')
  return lodashBroupBy(collection, iteratee)
}

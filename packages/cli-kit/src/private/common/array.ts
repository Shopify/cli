import {uniq} from '../../public/common/array.js'

export function unionArrayStrategy(destinationArray: unknown[], sourceArray: unknown[]): unknown[] {
  return uniq([...destinationArray, ...sourceArray])
}

import type {StoredFinding} from '../types.js'

/**
 * The one string and finding order the engine uses when it writes and combines documents. Code-point
 * order rather than `localeCompare`, so a document sorts the same on every machine and ICU version.
 */

export function compareStrings(left: string, right: string): number {
  if (left < right) return -1
  return left > right ? 1 : 0
}

/** File, then line with a missing line first. Callers add their own tie-breakers after this. */
export function compareFindingLocations(left: StoredFinding, right: StoredFinding): number {
  return (
    compareStrings(left.location.file, right.location.file) ||
    compareOptionalNumbers(left.location.line, right.location.line)
  )
}

/** A missing number sorts before any present one, including 0. */
function compareOptionalNumbers(left: number | undefined, right: number | undefined): number {
  if (left === right) return 0
  if (left === undefined) return -1
  if (right === undefined) return 1
  return left - right
}

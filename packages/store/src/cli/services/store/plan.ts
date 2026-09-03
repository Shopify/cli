import {PLAN_HANDLES_BY_NAME} from './constants.js'
import {capitalizeWords} from '@shopify/cli-kit/common/string'

/**
 * Maps a raw BP plan name (`Shop.planName`) to its public handle, or undefined when the plan
 * isn't recognized. Matching is case-insensitive; see {@link PLAN_HANDLES_BY_NAME}.
 */
export function planHandle(planName: string | null | undefined): string | undefined {
  if (!planName) return undefined
  return PLAN_HANDLES_BY_NAME[planName.toLowerCase()]
}

// Title-cased label for the `store list` table column (`plus` -> `Plus`). Unrecognized plans have
// no handle, so the column is left blank rather than showing a raw internal plan name.
export function planLabel(handle: string | undefined): string {
  return handle ? capitalizeWords(handle) : ''
}

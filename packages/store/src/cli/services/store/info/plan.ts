import {PLAN_HANDLES_BY_NAME} from '../constants.js'

/**
 * Maps a raw BP plan name (`Shop.planName`) to its public handle, or undefined when the plan
 * isn't recognized. Matching is case-insensitive; see {@link PLAN_HANDLES_BY_NAME}.
 */
export function mapPlanToPublicHandle(planName: string | undefined): string | undefined {
  if (!planName) return undefined
  return PLAN_HANDLES_BY_NAME[planName.toLowerCase()]
}

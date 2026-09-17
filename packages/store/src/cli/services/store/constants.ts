export {devStorePlanHandles} from '@shopify/organizations'
export type {DevStorePlan} from '@shopify/organizations'

/**
 * A raw BP plan name (`Shop.planName`) → the public plan handle reported by `store info` and
 * `store list`.
 * The raw names are Shopify-internal and intentionally differ from the marketing names
 * (e.g. `professional` is Grow, `unlimited` is Advanced). The public handle is also accepted
 * as a key, because the exact form BP returns isn't pinned down by the schema. Anything not
 * listed here is treated as unrecognized and omitted from the output.
 */
export const PLAN_HANDLES_BY_NAME: {[planName: string]: string} = {
  basic: 'basic',
  professional: 'grow',
  grow: 'grow',
  unlimited: 'advanced',
  advanced: 'advanced',
  shopify_plus: 'plus',
  plus: 'plus',
}

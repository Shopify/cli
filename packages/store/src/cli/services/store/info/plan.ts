/**
 * Maps a raw BP plan name (`Shop.planName`) to the public plan handle surfaced by `store info`.
 *
 * The raw names BP returns are Shopify-internal and intentionally differ from the marketing
 * names (e.g. `professional` is Grow, `unlimited` is Advanced). The mapping is assumed stable
 * and 1:1, so it's hardcoded here rather than fetched. Both the internal name and the public
 * handle are accepted as keys because the exact form BP returns isn't pinned down by the schema.
 *
 * Anything not in this table is treated as unrecognized and omitted from the output.
 */
const PLAN_HANDLES: {[planName: string]: string} = {
  basic: 'basic',
  professional: 'grow',
  grow: 'grow',
  unlimited: 'advanced',
  advanced: 'advanced',
  shopify_plus: 'plus',
  plus: 'plus',
}

export function mapPlanToPublicHandle(planName: string | undefined): string | undefined {
  if (!planName) return undefined
  return PLAN_HANDLES[planName.toLowerCase()]
}

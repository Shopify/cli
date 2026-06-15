/**
 * Plan data shared by `store create dev` and `store info`.
 *
 * The two commands need the plan taxonomy in opposite directions, so each direction is its
 * own explicit map below. They're co-located here so the overlap is easy to keep in sync,
 * but deliberately written out in full rather than derived from one another — the explicit
 * form is far easier to read and reason about than any clever de-duplication.
 */

/**
 * `store create dev`: each user-facing `--plan` handle → the price lookup key the Business
 * Platform `createAppDevelopmentStore` mutation expects. The backend argument is a plain
 * string with no reusable enum, so this is the canonical source. The handles mirror the
 * labels shown in the Dev Dashboard store-creation form.
 */
export const DEV_STORE_PLANS = {
  basic: 'BASIC_APP_DEVELOPMENT',
  grow: 'PROFESSIONAL_APP_DEVELOPMENT',
  advanced: 'UNLIMITED_APP_DEVELOPMENT',
  plus: 'SHOPIFY_PLUS_APP_DEVELOPMENT',
} as const

/** A public, user-facing plan handle accepted by `--plan`. */
export type DevStorePlan = keyof typeof DEV_STORE_PLANS

/** The accepted `--plan` values, in display order (the keys of {@link DEV_STORE_PLANS}). */
export const devStorePlanHandles = Object.keys(DEV_STORE_PLANS) as DevStorePlan[]

/**
 * `store info`: a raw BP plan name (`Shop.planName`) → the public plan handle it reports.
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

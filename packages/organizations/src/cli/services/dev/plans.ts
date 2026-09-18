export const DEV_STORE_PLANS = {
  basic: 'BASIC_APP_DEVELOPMENT',
  grow: 'PROFESSIONAL_APP_DEVELOPMENT',
  advanced: 'UNLIMITED_APP_DEVELOPMENT',
  plus: 'SHOPIFY_PLUS_APP_DEVELOPMENT',
} as const
export type DevStorePlan = keyof typeof DEV_STORE_PLANS
export const devStorePlanHandles = Object.keys(DEV_STORE_PLANS) as DevStorePlan[]

import {Theme} from '@shopify/cli-kit/node/themes/types'

export const DEVELOPMENT_THEME_ROLE = 'development'
export const LIVE_THEME_ROLE = 'live'
export const UNPUBLISHED_THEME_ROLE = 'unpublished'

export type Role = typeof DEVELOPMENT_THEME_ROLE | typeof LIVE_THEME_ROLE | typeof UNPUBLISHED_THEME_ROLE

export function isDevelopmentTheme(theme: Theme) {
  return theme.role === DEVELOPMENT_THEME_ROLE
}

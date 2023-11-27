import {Theme} from '@shopify/cli-kit/node/themes/models/types'

export const DEVELOPMENT_THEME_ROLE = 'development'

export function isDevelopmentTheme(theme: Theme) {
  return theme.role === DEVELOPMENT_THEME_ROLE
}

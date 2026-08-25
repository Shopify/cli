import {Theme} from './types.js'
import {renderTextPrompt} from '../ui.js'
import {getRandomName} from '../../common/string.js'

const GID_REGEXP = /gid:\/\/shopify\/\w*\/(\d+)/

export const DEVELOPMENT_THEME_ROLE = 'development'
export const LIVE_THEME_ROLE = 'live'
export const UNPUBLISHED_THEME_ROLE = 'unpublished'

export type Role = typeof DEVELOPMENT_THEME_ROLE | typeof LIVE_THEME_ROLE | typeof UNPUBLISHED_THEME_ROLE

export function isDevelopmentTheme(theme: Theme) {
  return theme.role === DEVELOPMENT_THEME_ROLE
}

export async function promptThemeName(message: string) {
  const defaultName = await getRandomName('creative')
  return renderTextPrompt({
    message,
    defaultValue: defaultName,
  })
}

export function composeThemeGid(id: number): string {
  return `gid://shopify/OnlineStoreTheme/${id}`
}

export function parseGid(gid: string): number {
  const match = GID_REGEXP.exec(gid)?.[1]
  if (!match) {
    throw new Error(`Invalid GID: ${gid}`)
  }

  return parseInt(match, 10)
}

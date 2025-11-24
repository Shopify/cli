import {Theme} from './types.js'
import {renderTextPrompt} from '../ui.js'
import {getRandomName} from '../../common/string.js'
import {platform} from 'os'

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
  const matches = GID_REGEXP.exec(gid)
  if (matches && matches[1] !== undefined) {
    return parseInt(matches[1], 10)
  }
  throw new Error(`Invalid GID: ${gid}`)
}

export function filePathToFileUrl(filePath: string): string {
  let normalized = filePath.replace(/\\/g, '/')

  if (platform() === 'win32') {
    normalized = `/${normalized}`
  }

  return encodeURI(`file://${normalized}`)
}

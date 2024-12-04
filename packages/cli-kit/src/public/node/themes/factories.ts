import {Checksum, Theme, ThemeAsset} from '@shopify/cli-kit/node/themes/types'

interface RemoteThemeResponse {
  id: number
  name: string
  role: string
  createdAtRuntime?: boolean
  processing?: boolean
}

interface RemoteAssetResponse {
  key: string
  checksum: string
  attachment: string | undefined
  // value is an empty string ('') when the file is empty
  value: string
}

export interface RemoteBulkUploadResponse {
  body: {asset?: RemoteAssetResponse; errors?: {asset: string[]}}
  code: number
}

export function buildTheme(themeJson?: RemoteThemeResponse): Theme | undefined {
  if (!themeJson) return

  themeJson.processing ??= false
  themeJson.createdAtRuntime ??= false

  const {id, name, role, processing, createdAtRuntime} = themeJson

  return {
    id,
    name,
    processing,
    createdAtRuntime,
    role: role === 'main' ? 'live' : role,
  }
}

export function buildChecksum(asset?: RemoteAssetResponse): Checksum | undefined {
  if (!asset) return

  const {key, checksum} = asset
  return {key, checksum}
}

export function buildThemeAsset(asset: undefined): undefined
export function buildThemeAsset(asset: RemoteAssetResponse): ThemeAsset
export function buildThemeAsset(asset?: RemoteAssetResponse): ThemeAsset | undefined {
  if (!asset) return

  const {key, checksum, attachment, value} = asset
  // Note: for attachments, this is the size of the base64 string, not the real length of the file
  const stats = {size: (value || attachment || '').length, mtime: Date.now()}
  return {key, checksum, attachment, value, stats}
}

import {BulkUploadResult, Checksum, Theme, ThemeAsset} from '@shopify/cli-kit/node/themes/types'

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
  attachment: string
  value: string
}

interface RemoteBulkUploadResponse {
  body: {asset?: RemoteAssetResponse; errors?: {value: string}}
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

export function buildThemeAsset(asset?: RemoteAssetResponse): ThemeAsset | undefined {
  if (!asset) return

  const {key, checksum, attachment, value} = asset
  return {key, checksum, attachment, value}
}

export function buildBulkUploadResults(bulkUpload?: RemoteBulkUploadResponse): BulkUploadResult | undefined {
  if (!bulkUpload) return

  return {
    key: bulkUpload.body.asset?.key,
    success: bulkUpload.code === 200,
    errors: bulkUpload.body.errors || {},
    asset: bulkUpload.body.asset,
  }
}

import {BulkUploadResult, Checksum, Theme, ThemeAsset} from '@shopify/cli-kit/node/themes/types'

interface RemoteThemeJson {
  id: number
  name: string
  role: string
  createdAtRuntime?: boolean
  processing?: boolean
}

export interface RemoteAssetJson {
  key: string
  checksum: string
  attachment: string
  value: string
}

export interface BulkUploadResponse {
  body: {asset: RemoteAssetJson}
  code: number
  errors?: string[]
}

export function buildTheme(themeJson?: RemoteThemeJson): Theme | undefined {
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

export function buildChecksum(assetJson?: RemoteAssetJson): Checksum | undefined {
  if (!assetJson) return

  const {key, checksum} = assetJson
  return {key, checksum}
}

export function buildThemeAsset(assetJson?: RemoteAssetJson): ThemeAsset | undefined {
  if (!assetJson) return

  const {key, checksum, attachment, value} = assetJson
  return {key, checksum, attachment, value}
}

export function buildBulkUploadResults(response?: BulkUploadResponse): BulkUploadResult | undefined {
  if (!response) return

  return {
    key: response.body.asset.key,
    success: response.code === 200,
    errors: response.errors || [],
    asset: response.body.asset || {},
  }
}

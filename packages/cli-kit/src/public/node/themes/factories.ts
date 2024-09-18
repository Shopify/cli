import {AssetParams} from './api.js'
import {Result, Checksum, Theme, ThemeAsset, Operation} from '@shopify/cli-kit/node/themes/types'

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
  const valueOrAttachment = value || attachment
  const size = valueOrAttachment ? valueOrAttachment.length : 0
  const stats = {size, mtime: Date.now()}

  return {key, checksum, attachment, value, stats}
}

export function buildBulkUploadResults(
  bulkUploadResponse: RemoteBulkUploadResponse[],
  assets: AssetParams[],
): Result[] {
  if (!bulkUploadResponse) {
    return []
  }

  return bulkUploadResponse.map((bulkUpload, index) => {
    return {
      key: assets[index]!.key,
      success: bulkUpload.code === 200,
      errors: bulkUpload.body.errors || {},
      asset: bulkUpload.body.asset,
      operation: Operation.Upload,
    }
  })
}

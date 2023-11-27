import {Checksum, Theme, ThemeAsset} from '@shopify/cli-kit/node/themes/models/index'

interface RemoteThemeJson {
  id: number
  name: string
  role: string
  createdAtRuntime?: boolean
  processing?: boolean
}

interface RemoteAssetJson {
  key: string
  checksum: string
  attachment: string
  value: string
}

export function buildTheme(themeJson?: RemoteThemeJson): Theme | undefined {
  if (!themeJson) return

  themeJson.processing ??= false
  themeJson.createdAtRuntime ??= false

  const {id, name, role, processing, createdAtRuntime} = themeJson

  const files = new Map()

  return {
    id,
    name,
    files,
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

  const {key, attachment, value} = assetJson
  return {key, attachment, value}
}

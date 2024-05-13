import {ThemeAsset, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'

export function fakeThemeFileSystem(root: string, files: Map<string, ThemeAsset>): ThemeFileSystem {
  return {
    root,
    files,
    delete: async (assetKey: string) => {
      files.delete(assetKey)
    },
    write: async (asset: ThemeAsset) => {
      files.set(asset.key, asset)
    },
    read: async (assetKey: string) => {
      return files.get(assetKey)?.value || files.get(assetKey)?.attachment
    },
  }
}

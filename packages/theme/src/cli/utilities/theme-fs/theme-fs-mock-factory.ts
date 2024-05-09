import {ThemeAsset, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'

export function mockThemeFileSystem(root: string, files: Map<string, ThemeAsset>): ThemeFileSystem {
  return {
    root,
    files,
    delete: async (asset: ThemeAsset) => {
      files.delete(asset.key)
    },
    write: async (asset: ThemeAsset) => {
      files.set(asset.key, asset)
    },
  }
}

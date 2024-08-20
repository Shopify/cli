import {ThemeAsset, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'

export function fakeThemeFileSystem(root: string, files: Map<string, ThemeAsset>): ThemeFileSystem {
  return {
    root,
    files,
    ready: () => Promise.resolve(),
    delete: async (fileKey: string) => {
      files.delete(fileKey)
    },
    write: async (asset: ThemeAsset) => {
      files.set(asset.key, asset)
    },
    read: async (fileKey: string) => {
      return files.get(fileKey)?.value || files.get(fileKey)?.attachment
    },
    stat: async (_fileKey: string) => {
      return {mtime: new Date(), size: 1}
    },
    addEventListener: () => {},
    startWatcher: async () => {},
  }
}

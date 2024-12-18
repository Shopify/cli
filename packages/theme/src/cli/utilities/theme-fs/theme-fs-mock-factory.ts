import {applyIgnoreFilters} from '../asset-ignore.js'
import type {ThemeAsset, ThemeFileSystem, ThemeFileSystemOptions} from '@shopify/cli-kit/node/themes/types'

export function fakeThemeFileSystem(
  root: string,
  files: Map<string, ThemeAsset>,
  options?: ThemeFileSystemOptions,
): ThemeFileSystem {
  return {
    root,
    files,
    unsyncedFileKeys: new Set(),
    ready: () => Promise.resolve(),
    delete: async (fileKey: string) => {
      files.delete(fileKey)
    },
    write: async (asset: ThemeAsset) => {
      files.set(asset.key, asset)
    },
    read: async (fileKey: string) => {
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      return files.get(fileKey)?.value || files.get(fileKey)?.attachment
    },
    addEventListener: () => {},
    applyIgnoreFilters: (files) => applyIgnoreFilters(files, options?.filters),
    startWatcher: async () => {},
  }
}

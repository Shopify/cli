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
      return files.get(fileKey)?.value ?? files.get(fileKey)?.attachment
    },
    addEventListener: () => {},
    applyIgnoreFilters: <T extends {key: string}>(files: T[]) =>
      applyIgnoreFilters(files, options?.filters).filter((file): file is T => file !== undefined),
    startWatcher: async () => {},
  }
}

import {ThemeAsset, ThemeExtensionFileSystem, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'

export function emptyThemeFileSystem(): ThemeFileSystem {
  return emptyFileSystem()
}

export function emptyThemeExtFileSystem(): ThemeExtensionFileSystem {
  return emptyFileSystem()
}

function emptyFileSystem<T>(): T {
  return {
    root: '',
    files: new Map(),
    unsyncedFileKeys: new Set(),
    uploadErrors: new Map(),
    ready: () => Promise.resolve(),
    delete: async (_: string) => {},
    read: async (_: string) => '',
    write: async (_: ThemeAsset) => {},
    stat: async (_: string) => ({mtime: new Date(), size: 1}),
    addEventListener: () => {},
    startWatcher: async () => {},
  } as T
}

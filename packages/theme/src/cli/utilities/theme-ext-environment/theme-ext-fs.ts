import {readThemeFile} from '../theme-fs.js'
import {calculateChecksum} from '../asset-checksum.js'
import {DEFAULT_IGNORE_PATTERNS} from '../../constants.js'
import {glob} from '@shopify/cli-kit/node/fs'
import {joinPath, relativePath} from '@shopify/cli-kit/node/path'
import {sleep} from '@shopify/cli-kit/node/system'
import {buildThemeAsset} from '@shopify/cli-kit/node/themes/factories'
import EventEmitter from 'node:events'
import type {
  ThemeAsset,
  ThemeExtensionFileSystem,
  ThemeFSEventName,
  ThemeFSEventPayload,
} from '@shopify/cli-kit/node/themes/types'

const THEME_EXT_DIRECTORY_PATTERNS = [
  'assets/**/*.*',
  'locales/**/*.json',
  'blocks/**/*.liquid',
  'snippets/**/*.liquid',
]

export function mountThemeExtensionFileSystem(root: string): ThemeExtensionFileSystem {
  const files = new Map<string, ThemeAsset>()
  const unsyncedFileKeys = new Set<string>()
  const eventEmitter = new EventEmitter()

  const emitEvent = <T extends ThemeFSEventName>(eventName: T, payload: ThemeFSEventPayload<T>) => {
    eventEmitter.emit(eventName, payload)
  }

  const read = async (key: string) => {
    const fileContent = await readThemeFile(root, key)
    const checksum = calculateChecksum(key, fileContent)
    const value = typeof fileContent === 'string' ? fileContent : ''
    const attachment = Buffer.isBuffer(fileContent) ? fileContent.toString('base64') : ''

    files.set(key, buildThemeAsset({key, checksum, value, attachment}))

    return fileContent
  }

  const initialFilesPromise = glob(THEME_EXT_DIRECTORY_PATTERNS, {
    cwd: root,
    deep: 3,
    ignore: DEFAULT_IGNORE_PATTERNS,
  }).then((filesPaths) => Promise.all(filesPaths.map(read)))

  const handleFileUpdate = (eventName: 'add' | 'change', filePath: string) => {
    const fileKey = relativePath(root, filePath)

    const contentPromise = read(fileKey).then(() => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const file = files.get(fileKey)!

      unsyncedFileKeys.add(file.key)

      return file.value || file.attachment || ''
    })

    sleep(5)
      .then(() => {
        unsyncedFileKeys.delete(fileKey)
      })
      .catch(() => {})

    emitEvent(eventName, {
      fileKey,
      onContent: (fn) => {
        contentPromise
          .then((content) => {
            if (content) fn(content)
          })
          .catch(() => {})
      },
      onSync: (_) => {},
    })
  }

  const handleFileDelete = (filePath: string) => {
    const fileKey = relativePath(root, filePath)

    unsyncedFileKeys.delete(fileKey)

    files.delete(fileKey)

    emitEvent('unlink', {
      fileKey,
    })
  }

  const directoriesToWatch = new Set(
    THEME_EXT_DIRECTORY_PATTERNS.map((pattern) => joinPath(root, pattern.split('/').shift() ?? '')),
  )

  return {
    root,
    files,
    unsyncedFileKeys,
    ready: async () => {
      return initialFilesPromise.then(() => {})
    },
    delete: async (fileKey: string) => {
      files.delete(fileKey)
    },
    write: async (asset: ThemeAsset) => {
      files.set(asset.key, asset)
    },
    read,
    addEventListener: (eventName, cb) => {
      eventEmitter.on(eventName, cb)
    },
    startWatcher: async () => {
      const {default: chokidar} = await import('chokidar')

      const watcher = chokidar.watch([...directoriesToWatch], {
        ignored: DEFAULT_IGNORE_PATTERNS,
        persistent: !process.env.SHOPIFY_UNIT_TEST,
        ignoreInitial: true,
        // Big files (e.g. Tailwind output) can take a while to write.
        // Delaying the event until the file size doesn't change for a
        // short period ensures that we get the fully written file:
        awaitWriteFinish: {
          stabilityThreshold: 400,
          pollInterval: 100,
        },
      })

      watcher
        .on('add', handleFileUpdate.bind(null, 'add'))
        .on('change', handleFileUpdate.bind(null, 'change'))
        .on('unlink', handleFileDelete.bind(null))
    },
  }
}

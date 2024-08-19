/* eslint-disable promise/no-nesting */
import {checksum} from './asset-checksum.js'
import {ThemeFileSystem, Key, ThemeAsset, ThemeFSEventName, type ThemeFSEvent} from '@shopify/cli-kit/node/themes/types'
import {glob, readFile, ReadOptions, fileExists, mkdir, writeFile, removeFile} from '@shopify/cli-kit/node/fs'
import {joinPath, basename, relativePath} from '@shopify/cli-kit/node/path'
import {lookupMimeType, setMimeTypes} from '@shopify/cli-kit/node/mimes'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {buildThemeAsset} from '@shopify/cli-kit/node/themes/factories'
import EventEmitter from 'node:events'
import {stat} from 'fs/promises'

export const THEME_DEFAULT_IGNORE_PATTERNS = [
  '**/.git',
  '**/.vscode',
  '**/.hg',
  '**/.bzr',
  '**/.svn',
  '**/_darcs',
  '**/CVS',
  '**/*.sublime-(project|workspace)',
  '**/.DS_Store',
  '**/.sass-cache',
  '**/Thumbs.db',
  '**/desktop.ini',
  '**/config.yml',
  '**/node_modules/',
  '.prettierrc.json',
]

export const THEME_DIRECTORY_PATTERNS = [
  'assets/**/*.*',
  'config/**/*.json',
  'layout/**/*.liquid',
  'locales/**/*.json',
  'sections/**/*.{liquid,json}',
  'blocks/**/*.liquid',
  'snippets/**/*.liquid',
  'templates/**/*.{liquid,json}',
  'templates/customers/**/*.{liquid,json}',
]

const THEME_PARTITION_REGEX = {
  liquidRegex: /\.liquid$/,
  configRegex: /^config\/(settings_schema|settings_data)\.json$/,
  jsonRegex: /^(?!config\/).*\.json$/,
  contextualizedJsonRegex: /\.context\.[^.]+\.json$/i,
  staticAssetRegex: /^assets\/(?!.*\.liquid$)/,
}

export async function mountThemeFileSystem(root: string): Promise<ThemeFileSystem> {
  const files = new Map<string, ThemeAsset>()
  const eventEmitter = new EventEmitter()
  function emitEvent<T extends ThemeFSEventName>(eventName: T, payload: ThemeFSEvent<T>['payload']) {
    eventEmitter.emit(eventName, payload)
  }

  const initialFilesPromise = glob(THEME_DIRECTORY_PATTERNS, {
    cwd: root,
    deep: 3,
    ignore: THEME_DEFAULT_IGNORE_PATTERNS,
  }).then((filesPaths) => {
    return Promise.all(
      filesPaths.map(async (key) => {
        files.set(key, {
          key,
          checksum: await checksum(root, key),
        })
      }),
    )
  })

  initialFilesPromise
    .then(async () => {
      const getKey = (filePath: string) => relativePath(root, filePath)
      const handleFileUpdate = (eventName: 'add' | 'change', filePath: string) => {
        const fileKey = getKey(filePath)

        const contentPromise = checksum(root, fileKey)
          .then((checksum) => {
            files.set(fileKey, {key: fileKey, checksum})
            return readThemeFile(root, fileKey)
          })
          .then((content) => {
            const file = files.get(fileKey)
            if (!file) return ''
            file.value = content!.toString()
            return file.value
          })
          .catch(() => '')

        emitEvent(eventName, {
          fileKey,
          contentPromise,
          syncPromise: Promise.resolve(),
        })
      }

      const handleFileDelete = (filePath: string) => {
        const fileKey = getKey(filePath)
        files.delete(fileKey)

        emitEvent('unlink', {
          fileKey,
          syncPromise: Promise.resolve(),
        })
      }

      const {default: chokidar} = await import('chokidar')

      const directoriesToWatch = new Set(
        THEME_DIRECTORY_PATTERNS.map((pattern) => joinPath(root, pattern.split('/').shift() ?? '')),
      )

      const watcher = chokidar.watch([...directoriesToWatch], {
        ignored: THEME_DEFAULT_IGNORE_PATTERNS,
        persistent: !process.env.SHOPIFY_UNIT_TEST,
        ignoreInitial: true,
      })

      watcher
        .on('add', handleFileUpdate.bind(null, 'add'))
        .on('change', handleFileUpdate.bind(null, 'change'))
        .on('unlink', handleFileDelete)
    })
    .catch(() => {})

  return {
    root,
    files,
    ready: () => initialFilesPromise.then(() => {}),
    delete: async (assetKey: string) => {
      await removeThemeFile(root, assetKey)
      files.delete(assetKey)
    },
    write: async (asset: ThemeAsset) => {
      await writeThemeFile(root, asset)
      files.set(asset.key, asset)
    },
    read: async (assetKey: string) => {
      const fileValue = await readThemeFile(root, assetKey)
      const fileChecksum = await checksum(root, assetKey)
      files.set(
        assetKey,
        buildThemeAsset({
          key: assetKey,
          value: typeof fileValue === 'string' ? fileValue : '',
          checksum: fileChecksum,
          attachment: Buffer.isBuffer(fileValue) ? fileValue.toString('base64') : '',
        })!,
      )
      return fileValue
    },
    stat: async (assetKey: string) => {
      if (files.has(assetKey)) {
        const absolutePath = joinPath(root, assetKey)
        const stats = await stat(absolutePath)
        if (stats.isFile()) {
          const fileReducedStats = {size: stats.size, mtime: stats.mtime}
          return fileReducedStats
        }
      }
    },
    addEventListener: (eventName, cb) => {
      eventEmitter.on(eventName, cb)
    },
  }
}

async function writeThemeFile(root: string, {key, attachment, value}: ThemeAsset) {
  const absolutePath = joinPath(root, key)

  await ensureDirExists(absolutePath)

  if (attachment) {
    const data = Buffer.from(attachment, 'base64')
    await writeFile(absolutePath, data, {encoding: 'base64'})
  } else {
    const data = value ?? ''
    await writeFile(absolutePath, data)
  }
}

export async function readThemeFile(root: string, path: Key): Promise<string | Buffer | undefined> {
  const options: ReadOptions = isTextFile(path) ? {encoding: 'utf8'} : {}
  const absolutePath = joinPath(root, path)

  const themeFileExists = await fileExists(absolutePath)
  if (!themeFileExists) {
    outputDebug(`File ${absolutePath} can't be read because it doesn't exist...`)
    return
  }

  return readFile(absolutePath, options)
}

async function removeThemeFile(root: string, path: Key) {
  const absolutePath = joinPath(root, path)

  const themeFileExists = await fileExists(absolutePath)
  if (!themeFileExists) {
    outputDebug(`File ${absolutePath} can't be removed because it doesn't exist...`)
    return
  }

  await removeFile(absolutePath)
}

export function isThemeAsset(path: string) {
  return path.startsWith('assets/')
}

export function isJson(path: string) {
  return lookupMimeType(path) === 'application/json'
}

export function partitionThemeFiles(files: ThemeAsset[]) {
  const liquidFiles: ThemeAsset[] = []
  const jsonFiles: ThemeAsset[] = []
  const contextualizedJsonFiles: ThemeAsset[] = []
  const configFiles: ThemeAsset[] = []
  const staticAssetFiles: ThemeAsset[] = []

  files.forEach((file) => {
    const fileKey = file.key
    if (THEME_PARTITION_REGEX.liquidRegex.test(fileKey)) {
      liquidFiles.push(file)
    } else if (THEME_PARTITION_REGEX.configRegex.test(fileKey)) {
      configFiles.push(file)
    } else if (THEME_PARTITION_REGEX.jsonRegex.test(fileKey)) {
      if (THEME_PARTITION_REGEX.contextualizedJsonRegex.test(fileKey)) {
        contextualizedJsonFiles.push(file)
      } else {
        jsonFiles.push(file)
      }
    } else if (THEME_PARTITION_REGEX.staticAssetRegex.test(fileKey)) {
      staticAssetFiles.push(file)
    }
  })

  return {liquidFiles, jsonFiles, contextualizedJsonFiles, configFiles, staticAssetFiles}
}

export async function readThemeFilesFromDisk(filesToRead: ThemeAsset[], themeFileSystem: ThemeFileSystem) {
  outputDebug(`Reading theme files from disk: ${filesToRead.map((file) => file.key).join(', ')}`)
  await Promise.all(
    filesToRead.map(async (file) => {
      const fileKey = file.key
      const themeAsset = themeFileSystem.files.get(fileKey)
      if (themeAsset === undefined) {
        outputDebug(`File ${fileKey} can't be was not found under directory starting with: ${themeFileSystem.root}`)
        return
      }

      outputDebug(`Reading theme file: ${fileKey}`)
      const fileData = await readThemeFile(themeFileSystem.root, fileKey)
      if (Buffer.isBuffer(fileData)) {
        themeAsset.attachment = fileData.toString('base64')
      } else {
        themeAsset.value = fileData
      }
      themeFileSystem.files.set(fileKey, themeAsset)
    }),
  )
  outputDebug('All theme files were read from disk')
}

export function isTextFile(path: string) {
  setMimeTypes({
    liquid: 'application/liquid',
    sass: 'text/x-sass',
    scss: 'text/x-scss',
  })

  const textFileTypes = [
    'application/javascript',
    'application/json',
    'application/liquid',
    'text/css',
    'text/x-sass',
    'text/x-scss',
  ]

  return textFileTypes.includes(lookupMimeType(path))
}

export async function hasRequiredThemeDirectories(path: string) {
  const directories = new Set(
    await glob('*', {
      cwd: path,
      deep: 1,
      onlyDirectories: true,
    }),
  )

  const requiredDirectories = ['config', 'layout', 'sections', 'templates']

  return requiredDirectories.every((dir) => directories.has(dir))
}

async function ensureDirExists(path: string) {
  const directoryPath = dirPath(path)

  const directoryExists = await fileExists(directoryPath)
  if (directoryExists) return

  await mkdir(directoryPath)
}

function dirPath(filePath: string) {
  const fileName = basename(filePath)
  const fileNameIndex = filePath.lastIndexOf(fileName)

  return filePath.substring(0, fileNameIndex)
}

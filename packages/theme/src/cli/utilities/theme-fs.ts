import {calculateChecksum} from './asset-checksum.js'
import {glob, readFile, ReadOptions, fileExists, mkdir, writeFile, removeFile} from '@shopify/cli-kit/node/fs'
import {joinPath, basename, relativePath} from '@shopify/cli-kit/node/path'
import {lookupMimeType, setMimeTypes} from '@shopify/cli-kit/node/mimes'
import {outputContent, outputDebug, outputInfo, outputToken} from '@shopify/cli-kit/node/output'
import {buildThemeAsset} from '@shopify/cli-kit/node/themes/factories'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {bulkUploadThemeAssets, deleteThemeAsset} from '@shopify/cli-kit/node/themes/api'
import {renderError} from '@shopify/cli-kit/node/ui'
import EventEmitter from 'node:events'
import {stat} from 'fs/promises'
import type {
  ThemeFileSystem,
  Key,
  ThemeAsset,
  ThemeFSEventName,
  ThemeFSEventPayload,
} from '@shopify/cli-kit/node/themes/types'

const THEME_DEFAULT_IGNORE_PATTERNS = [
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

const THEME_DIRECTORY_PATTERNS = [
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
  const emitEvent = <T extends ThemeFSEventName>(eventName: T, payload: ThemeFSEventPayload<T>) => {
    eventEmitter.emit(eventName, payload)
  }

  const read = async (fileKey: string) => {
    const fileContent = await readThemeFile(root, fileKey)
    const fileChecksum = await calculateChecksum(fileKey, fileContent)

    files.set(
      fileKey,
      buildThemeAsset({
        key: fileKey,
        checksum: fileChecksum,
        value: typeof fileContent === 'string' ? fileContent : '',
        attachment: Buffer.isBuffer(fileContent) ? fileContent.toString('base64') : '',
      }),
    )

    return fileContent
  }

  const initialFilesPromise = glob(THEME_DIRECTORY_PATTERNS, {
    cwd: root,
    deep: 3,
    ignore: THEME_DEFAULT_IGNORE_PATTERNS,
  }).then((filesPaths) => Promise.all(filesPaths.map(read)))

  const getKey = (filePath: string) => relativePath(root, filePath)
  const handleFileUpdate = (
    eventName: 'add' | 'change',
    themeId: string,
    adminSession: AdminSession,
    filePath: string,
  ) => {
    const fileKey = getKey(filePath)

    const contentPromise = read(fileKey).then(() => files.get(fileKey)?.value ?? '')

    // contentPromise resolves to file.value and does not include file.attachment
    const syncPromise = contentPromise.then(async (_content) => {
      const file = files.get(fileKey)!

      const results = await bulkUploadThemeAssets(
        Number(themeId),
        [{key: fileKey, value: file.value || file.attachment}],
        adminSession,
      )
      results.forEach((result) => {
        if (result.success) {
          outputSyncResult('update', fileKey)
        } else if (result.errors?.asset) {
          const errorMessage = `${fileKey}:\n${result.errors.asset.map((error) => `- ${error}`).join('\n')}`

          renderError({
            headline: 'Failed to sync file to remote theme.',
            body: errorMessage,
          })
          throw new Error()
        }
      })
    })

    emitEvent(eventName, {
      fileKey,
      onContent: (fn) => {
        contentPromise.then(fn).catch(() => {})
      },
      onSync: (fn) => {
        syncPromise.then(fn).catch(() => {})
      },
    })
  }

  const handleFileDelete = (themeId: string, adminSession: AdminSession, filePath: string) => {
    const fileKey = getKey(filePath)
    files.delete(fileKey)

    const syncPromise = Promise.resolve().then(async () => {
      const success = await deleteThemeAsset(Number(themeId), fileKey, adminSession)
      if (success) {
        outputSyncResult('delete', fileKey)
      } else {
        throw new Error(`Failed to delete file ${filePath}`)
      }
    })

    emitEvent('unlink', {
      fileKey,
      onSync: (fn) => {
        syncPromise.then(fn).catch(() => {})
      },
    })
  }

  const directoriesToWatch = new Set(
    THEME_DIRECTORY_PATTERNS.map((pattern) => joinPath(root, pattern.split('/').shift() ?? '')),
  )

  return {
    root,
    files,
    ready: () => initialFilesPromise.then(() => {}),
    delete: async (fileKey: string) => {
      await removeThemeFile(root, fileKey)
      files.delete(fileKey)
    },
    write: async (asset: ThemeAsset) => {
      await writeThemeFile(root, asset)
      files.set(asset.key, asset)
    },
    read,
    stat: async (fileKey: string) => {
      if (files.has(fileKey)) {
        const absolutePath = joinPath(root, fileKey)
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
    startWatcher: async (themeId: string, adminSession: AdminSession) => {
      const {default: chokidar} = await import('chokidar')

      const watcher = chokidar.watch([...directoriesToWatch], {
        ignored: THEME_DEFAULT_IGNORE_PATTERNS,
        persistent: !process.env.SHOPIFY_UNIT_TEST,
        ignoreInitial: true,
      })

      watcher
        .on('add', handleFileUpdate.bind(null, 'add', themeId, adminSession))
        .on('change', handleFileUpdate.bind(null, 'change', themeId, adminSession))
        .on('unlink', handleFileDelete.bind(null, themeId, adminSession))
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

function outputSyncResult(action: 'update' | 'delete', fileKey: string): void {
  outputInfo(
    outputContent`• ${new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })} Synced ${outputToken.raw('»')} ${outputToken.gray(`${action} ${fileKey}`)}`,
  )
}

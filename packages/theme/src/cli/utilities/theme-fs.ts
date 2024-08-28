import {calculateChecksum} from './asset-checksum.js'
import {
  applyIgnoreFilters,
  raiseWarningForNonExplicitGlobPatterns,
  getPatternsFromShopifyIgnore,
} from './asset-ignore.js'
import {glob, readFile, ReadOptions, fileExists, mkdir, writeFile, removeFile} from '@shopify/cli-kit/node/fs'
import {joinPath, basename, relativePath} from '@shopify/cli-kit/node/path'
import {lookupMimeType, setMimeTypes} from '@shopify/cli-kit/node/mimes'
import {outputContent, outputDebug, outputInfo, outputToken} from '@shopify/cli-kit/node/output'
import {buildThemeAsset} from '@shopify/cli-kit/node/themes/factories'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {bulkUploadThemeAssets, deleteThemeAsset} from '@shopify/cli-kit/node/themes/api'
import {renderError, renderWarning} from '@shopify/cli-kit/node/ui'
import EventEmitter from 'node:events'
import type {
  ThemeFileSystem,
  ThemeFileSystemOptions,
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
  sectionLiquidRegex: /^sections\/.+\.liquid$/,
  liquidRegex: /\.liquid$/,
  configRegex: /^config\/(settings_schema|settings_data)\.json$/,
  sectionJsonRegex: /^sections\/.+\.json$/,
  templateJsonRegex: /^templates\/.+\.json$/,
  jsonRegex: /^(?!config\/).*\.json$/,
  contextualizedJsonRegex: /\.context\.[^.]+\.json$/i,
  staticAssetRegex: /^assets\/(?!.*\.liquid$)/,
}

export function mountThemeFileSystem(root: string, options?: ThemeFileSystemOptions): ThemeFileSystem {
  const files = new Map<string, ThemeAsset>()
  const unsyncedFileKeys = new Set<string>()
  const filterPatterns = {
    ignoreFromFile: [] as string[],
    ignore: options?.filters?.ignore ?? [],
    only: options?.filters?.only ?? [],
  }
  const eventEmitter = new EventEmitter()
  const emitEvent = <T extends ThemeFSEventName>(eventName: T, payload: ThemeFSEventPayload<T>) => {
    eventEmitter.emit(eventName, payload)
  }

  const read = async (fileKey: string) => {
    const fileContent = await readThemeFile(root, fileKey)
    const fileChecksum = calculateChecksum(fileKey, fileContent)

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

  const themeSetupPromise = glob(THEME_DIRECTORY_PATTERNS, {
    cwd: root,
    deep: 3,
    ignore: THEME_DEFAULT_IGNORE_PATTERNS,
  })
    .then((filesPaths) => Promise.all([getPatternsFromShopifyIgnore(root), ...filesPaths.map(read)]))
    .then(([ignoredPatterns]) => {
      filterPatterns.ignoreFromFile.push(...ignoredPatterns)
      raiseWarningForNonExplicitGlobPatterns([
        ...filterPatterns.ignoreFromFile,
        ...filterPatterns.ignore,
        ...filterPatterns.only,
      ])
    })

  const getKey = (filePath: string) => relativePath(root, filePath)
  const isFileIgnored = (fileKey: string) => applyIgnoreFilters([{key: fileKey}], filterPatterns).length === 0

  const handleFileUpdate = (
    eventName: 'add' | 'change',
    themeId: string,
    adminSession: AdminSession,
    filePath: string,
  ) => {
    const fileKey = getKey(filePath)
    if (isFileIgnored(fileKey)) return

    const lastChecksum = files.get(fileKey)?.checksum

    const contentPromise = read(fileKey).then(() => {
      const file = files.get(fileKey)!

      if (file.checksum === lastChecksum) {
        // Do not sync if the file has not changed
        return ''
      }

      unsyncedFileKeys.add(fileKey)

      return file.value || file.attachment || ''
    })

    const syncPromise = contentPromise.then(async (content) => {
      if (!content) return false

      const [result] = await bulkUploadThemeAssets(Number(themeId), [{key: fileKey, value: content}], adminSession)

      if (result?.success) {
        unsyncedFileKeys.delete(fileKey)
        outputSyncResult('update', fileKey)
      } else if (result?.errors?.asset) {
        const errorMessage = `${fileKey}:\n${result.errors.asset.map((error) => `- ${error}`).join('\n')}`

        renderError({
          headline: 'Failed to sync file to remote theme.',
          body: errorMessage,
        })

        return false
      }

      return true
    })

    emitEvent(eventName, {
      fileKey,
      onContent: (fn) => {
        contentPromise
          .then((content) => {
            if (content) fn(content)
          })
          .catch(() => {})
      },
      onSync: (fn) => {
        syncPromise
          .then((didSync) => {
            if (didSync) fn()
          })
          .catch(() => {})
      },
    })
  }

  const handleFileDelete = (themeId: string, adminSession: AdminSession, filePath: string) => {
    const fileKey = getKey(filePath)
    if (isFileIgnored(fileKey)) return

    unsyncedFileKeys.delete(fileKey)
    files.delete(fileKey)
    emitEvent('unlink', {fileKey})

    deleteThemeAsset(Number(themeId), fileKey, adminSession)
      .then((success) => {
        if (!success) throw new Error('Unknown issue.')
        outputSyncResult('delete', fileKey)
      })
      .catch((error) => {
        renderWarning({headline: `Failed to delete file "${fileKey}".`, body: error.message})
      })
  }

  const directoriesToWatch = new Set(
    THEME_DIRECTORY_PATTERNS.map((pattern) => joinPath(root, pattern.split('/').shift() ?? '')),
  )

  return {
    root,
    files,
    unsyncedFileKeys,
    ready: () => themeSetupPromise,
    delete: async (fileKey: string) => {
      await removeThemeFile(root, fileKey)
      files.delete(fileKey)
    },
    write: async (asset: ThemeAsset) => {
      await writeThemeFile(root, asset)
      files.set(asset.key, asset)
    },
    read,
    applyIgnoreFilters: (files) => applyIgnoreFilters(files, filterPatterns),
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

export function partitionThemeFiles<T extends {key: string}>(files: T[]) {
  const sectionLiquidFiles: T[] = []
  const otherLiquidFiles: T[] = []
  const sectionJsonFiles: T[] = []
  const templateJsonFiles: T[] = []
  const otherJsonFiles: T[] = []
  const contextualizedJsonFiles: T[] = []
  const configFiles: T[] = []
  const staticAssetFiles: T[] = []

  files.forEach((file) => {
    const fileKey = file.key
    if (THEME_PARTITION_REGEX.liquidRegex.test(fileKey)) {
      if (THEME_PARTITION_REGEX.sectionLiquidRegex.test(fileKey)) {
        sectionLiquidFiles.push(file)
      } else {
        otherLiquidFiles.push(file)
      }
    } else if (THEME_PARTITION_REGEX.configRegex.test(fileKey)) {
      configFiles.push(file)
    } else if (THEME_PARTITION_REGEX.jsonRegex.test(fileKey)) {
      if (THEME_PARTITION_REGEX.contextualizedJsonRegex.test(fileKey)) {
        contextualizedJsonFiles.push(file)
      } else if (THEME_PARTITION_REGEX.sectionJsonRegex.test(fileKey)) {
        sectionJsonFiles.push(file)
      } else if (THEME_PARTITION_REGEX.templateJsonRegex.test(fileKey)) {
        templateJsonFiles.push(file)
      } else {
        otherJsonFiles.push(file)
      }
    } else if (THEME_PARTITION_REGEX.staticAssetRegex.test(fileKey)) {
      staticAssetFiles.push(file)
    }
  })

  return {
    sectionLiquidFiles,
    otherLiquidFiles,
    sectionJsonFiles,
    templateJsonFiles,
    contextualizedJsonFiles,
    otherJsonFiles,
    configFiles,
    staticAssetFiles,
  }
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

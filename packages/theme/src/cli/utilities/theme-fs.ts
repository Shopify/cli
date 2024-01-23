import {checksum} from './asset-checksum.js'
import {ThemeFileSystem, Key, ThemeAsset} from '@shopify/cli-kit/node/themes/types'
import {glob, readFile, ReadOptions, fileExists, mkdir, writeFile, removeFile} from '@shopify/cli-kit/node/fs'
import {joinPath, basename} from '@shopify/cli-kit/node/path'
import {lookupMimeType, setMimeTypes} from '@shopify/cli-kit/node/mimes'
import {outputDebug} from '@shopify/cli-kit/node/output'

const DEFAULT_IGNORE_PATTERNS = [
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
  'snippets/**/*.liquid',
  'templates/**/*.{liquid,json}',
  'templates/customers/**/*.{liquid,json}',
]

const THEME_PARTITION_REGEX = {
  liquidRegex: /\.liquid$/,
  configRegex: /^config\/(settings_schema|settings_data)\.json$/,
  jsonRegex: /^(?!config\/).*\.json$/,
  staticAssetRegex: /^assets\/(?!.*\.liquid$)/,
}

export async function mountThemeFileSystem(root: string): Promise<ThemeFileSystem> {
  const filesPaths = await glob(THEME_DIRECTORY_PATTERNS, {
    cwd: root,
    deep: 3,
    ignore: DEFAULT_IGNORE_PATTERNS,
  })

  const assets = await Promise.all(
    filesPaths.map(async (key) => {
      return checksum(root, key).then((checksum) => {
        return {
          key,
          checksum,
        }
      })
    }),
  )
  const files = new Map(assets.map((asset) => [asset.key, asset]))

  return {
    root,
    files,
  }
}

export async function writeThemeFile(root: string, {key, attachment, value}: ThemeAsset) {
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

export async function removeThemeFile(root: string, path: Key) {
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

export function partitionThemeFiles(files: string[]) {
  const liquidFiles: string[] = []
  const jsonFiles: string[] = []
  const configFiles: string[] = []
  const staticAssetFiles: string[] = []

  files.forEach((key) => {
    if (THEME_PARTITION_REGEX.liquidRegex.test(key)) {
      liquidFiles.push(key)
    } else if (THEME_PARTITION_REGEX.configRegex.test(key)) {
      configFiles.push(key)
    } else if (THEME_PARTITION_REGEX.jsonRegex.test(key)) {
      jsonFiles.push(key)
    } else if (THEME_PARTITION_REGEX.staticAssetRegex.test(key)) {
      staticAssetFiles.push(key)
    }
  })
  return {liquidFiles, jsonFiles, configFiles, staticAssetFiles}
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

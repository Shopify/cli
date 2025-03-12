import {TranslationTargetFile, TranslationSourceFile, Manifest} from './types.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {getPathValue, isEmpty} from '@shopify/cli-kit/common/object'
import {joinPath} from '@shopify/cli-kit/node/path'
import {readFileSync, glob, fileExistsSync, writeFileSync} from '@shopify/cli-kit/node/fs'
import {hashString} from '@shopify/cli-kit/node/crypto'

export function manifestFilePath(app: AppLinkedInterface): string {
  return joinPath(app.directory, '.shopify_translation_manifest.json')
}

export function getManifestData(app: AppLinkedInterface): Manifest {
  const filePath = manifestFilePath(app)
  if (!fileExistsSync(filePath)) {
    writeFileSync(filePath, JSON.stringify({}, null, 2))
  }
  const rawData = readFileSync(filePath)
  const manifestDatas = JSON.parse(rawData.toString())

  return manifestDatas as Manifest
}

export function manifestHash(value: string): string {
  return hashString(value)
}

export async function addFilesToTranslationFiles(
  directory: string,
  language: string,
  translationFiles: TranslationTargetFile[] | TranslationSourceFile[],
): Promise<void> {
  const pattern = joinPath(directory, '**', `${language}.json`)
  const files = await glob(pattern)

  for (const fullPath of files) {
    const data = readFileSync(fullPath).toString()
    translationFiles.push({
      fileName: fullPath,
      language,
      content: JSON.parse(data),
      keysToCreate: [],
      keysToDelete: [],
      keysToUpdate: [],
      manifestStrings: {},
    })
  }
}

export function getPaths(
  obj: {[key: string]: unknown} | undefined,
  ignoredPrefixes: string[] = [],
  prefix = '',
): string[] {
  if (obj === undefined) {
    return []
  }

  const paths = []

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const newPrefix = prefix ? `${prefix}.${key}` : key

      if (ignoredPrefixes.some((prefix) => key.startsWith(prefix))) {
        continue
      }

      if (typeof obj[key] === 'object' && obj[key] !== null) {
        paths.push(...getPaths(obj[key] as {[key: string]: unknown}, ignoredPrefixes, newPrefix))
      } else {
        paths.push(newPrefix)
      }
    }
  }

  return paths
}

// Returns true if the path starts with the prefix or includes the prefix as a dot-separated segment
export function pathHasPrefix(path: string | undefined, prefix: string | undefined): boolean {
  if (!path || !prefix) {
    return false
  }

  return path.startsWith(prefix) || path.includes(`.${prefix}`)
}

/**
 * Returns a flat object with the keys as the path to the value.
 */
export function flatObject(obj: {[key: string]: unknown}): {[key: string]: string} {
  const paths = getPaths(obj)
  const flat: {[key: string]: string} = {}
  for (const path of paths) {
    const value = getPathValue(obj, path)
    if (typeof value !== 'string') {
      continue
    }
    flat[path] = value
  }
  return flat
}

/**
 * Deletes empty objects from the given object. Also deletes objects which only have empty objects as children.
 *
 * @param obj - The object to delete empty objects from.
 */
export function deleteEmptyObjects(obj: {[key: string]: unknown}): boolean {
  let hasDeleted = false

  Object.keys(obj).forEach((key) => {
    if (typeof obj[key] === 'object') {
      if (isEmpty(obj[key] as object)) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete obj[key]
        hasDeleted = true
      } else if (deleteEmptyObjects(obj[key] as {[key: string]: unknown})) {
        // Check if parent became empty after cleaning children
        if (isEmpty(obj[key] as object)) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete obj[key]
          hasDeleted = true
        }
      }
    }
  })

  return hasDeleted
}

export function targetFileWithKey(
  targetFiles: TranslationTargetFile[],
  key: string,
): TranslationTargetFile | undefined {
  return targetFiles.find((targetFile) => [...targetFile.keysToCreate, ...targetFile.keysToUpdate].includes(key))
}

export function sourceTextForKey(sourceFiles: TranslationSourceFile[], key: string): string | undefined {
  const sourceFileWithKey = sourceFiles.find((sourceText) => Boolean(getPathValue(sourceText.content, key)))

  if (!sourceFileWithKey) {
    return undefined
  }

  return getPathValue(sourceFileWithKey.content, key) as string
}

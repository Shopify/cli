import {TranslationTargetFile, TranslationSourceFile, Manifest} from './types.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {isEmpty} from '@shopify/cli-kit/common/object'
import {joinPath} from '@shopify/cli-kit/node/path'
import {readFileSync, glob, fileExistsSync, writeFileSync} from '@shopify/cli-kit/node/fs'
import {hashString} from '@shopify/cli-kit/node/crypto'

export function manifestFilePath(app: AppLinkedInterface): string {
  return joinPath(app.directory, '.shopiofy_translation_manifest.json')
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

export function getPaths(obj: {[key: string]: unknown} | undefined, prefix = ''): string[] {
  if (obj === undefined) {
    return []
  }

  const paths = []

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const newPrefix = prefix ? `${prefix}.${key}` : key

      if (typeof obj[key] === 'object' && obj[key] !== null) {
        paths.push(...getPaths(obj[key] as {[key: string]: unknown}, newPrefix))
      } else {
        paths.push(newPrefix)
      }
    }
  }

  return paths
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

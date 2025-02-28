import {TranslationTargetFile, TranslationSourceFile} from '../translate.js'
import {isEmpty} from '@shopify/cli-kit/common/object'
import {joinPath} from '@shopify/cli-kit/node/path'
import {readFileSync, glob} from '@shopify/cli-kit/node/fs'

export async function searchDirectory(
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

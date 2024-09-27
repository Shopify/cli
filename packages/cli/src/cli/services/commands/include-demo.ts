/* eslint-disable no-await-in-loop */
import {decodeToml, JsonMapType, AnyJsonType, JsonArrayType} from '@shopify/cli-kit/node/toml'
import {fileExists, glob, readFile} from '@shopify/cli-kit/node/fs'
import {extname, dirname, joinPath} from '@shopify/cli-kit/node/path'

/**
 * Processes a loaded data structure, working through it recursively, to reconstitute it. Any inclusion directives are
 * processed. The result is the same data structure, with no remaining directives.
 *
 * @param loadedContent - The data structure to process.
 * @param basePath - The base path to use for resolving relative paths.
 * @param processedFiles - A set of files that have already been processed to detect circular includes.
 * @returns The processed data structure.
 */
async function processLoadedContent(
  loadedContent: AnyJsonType,
  basePath: string,
  processedFiles: Set<string>,
): Promise<AnyJsonType> {
  if (typeof loadedContent !== 'object' || loadedContent === null || loadedContent instanceof Date) {
    return loadedContent
  }

  if (Array.isArray(loadedContent)) {
    return Promise.all(
      loadedContent.map((item) => processLoadedContent(item, basePath, processedFiles)),
    ) as Promise<JsonArrayType>
  }

  let result: JsonMapType = {}

  const includeDirectives: {key: string; pathsToInclude: string[]}[] = []

  for (const [key, value] of Object.entries(loadedContent)) {
    if (key === '_include' && typeof value === 'string') {
      const pathsToInclude = (
        await Promise.all(
          value
            .split(',')
            .map((glob) => glob.trim())
            .map((includeGlob) => glob(joinPath(basePath, includeGlob))),
        )
      ).flat()
      includeDirectives.push({key, pathsToInclude})
    } else if (typeof value === 'object' && value !== null) {
      result[key] = await processLoadedContent(value, basePath, processedFiles)
    } else {
      result[key] = value
    }
  }

  for (const {pathsToInclude} of includeDirectives) {
    for (const includePath of pathsToInclude) {
      // Create a new Set for each include operation
      const includeProcessedFiles = new Set<string>(processedFiles)
      result = await processIncludePath(result, includePath, includeProcessedFiles)
    }
  }

  // Remove the _include key after processing
  delete result._include

  return result
}

async function processIncludePath(
  currentResult: JsonMapType,
  includePath: string,
  processedFiles: Set<string>,
): Promise<JsonMapType> {
  if (processedFiles.has(includePath)) {
    // If the file has already been processed in this include chain, throw an error
    throw new Error(`Circular include detected: ${includePath}`)
  }
  const {content: includeContent, meta} = await readAndDecodeFile(includePath)
  processedFiles.add(includePath)

  // Create a new Set for processing the included content
  const nestedProcessedFiles = new Set<string>(processedFiles)
  const processedInclude = await processLoadedContent(includeContent, dirname(includePath), nestedProcessedFiles)

  // If the processed include is a single-property object, then instead of the loaded item's meta being applied to the
  // parent, containing object (currentResult), the meta from the included file (meta) is applied to the single
  // property instead.
  // For arrays, if several files are setting a single property to an array, those arrays should be concatenated, rather
  // then overwriting one another.
  if (
    typeof processedInclude === 'object' &&
    processedInclude !== null &&
    !Array.isArray(processedInclude) &&
    !(processedInclude instanceof Date)
  ) {
    const processedKeys = Object.keys(processedInclude)
    const singleKey: string | undefined = processedKeys[0]
    if (processedKeys.length === 1 && singleKey && typeof processedInclude[singleKey] === 'object') {
      const currentValueUnderKey = currentResult[singleKey]
      if (
        Array.isArray(processedInclude[singleKey]) &&
        (Array.isArray(currentValueUnderKey) || currentValueUnderKey === undefined)
      ) {
        // Handle array entries
        return {
          ...currentResult,
          [singleKey]: [
            ...(currentValueUnderKey || []),
            ...(processedInclude[singleKey] as AnyJsonType[]).map((item) =>
              applyMetaSelectively(item as JsonMapType, meta),
            ),
          ] as JsonArrayType,
        }
      } else {
        // Handle single object
        return {
          ...currentResult,
          [singleKey]: applyMetaSelectively(processedInclude[singleKey] as JsonMapType, meta),
        }
      }
    }
  }

  // Merge the processed include, giving priority to the included content
  const mergedResult = {...currentResult, ...(processedInclude as JsonMapType)}
  return applyMetaSelectively(mergedResult, meta)
}

/**
 * Apply meta selectively to the content.
 *
 * If `path` or `root` are already present in the content, they are not overridden.
 *
 * @param content - The content to apply meta to.
 * @param meta - The meta to apply.
 * @returns The content with meta applied selectively.
 */
function applyMetaSelectively(content: JsonMapType, meta: {path: string; root: string}): JsonMapType {
  const result = {...content}
  if (!('path' in result)) {
    result.path = meta.path
  }
  if (!('root' in result)) {
    result.root = meta.root
  }
  return result
}

/**
 * Read and decode a file.
 *
 * @param filePath - The path to the file to read.
 * @returns The content and meta of the file.
 */
async function readAndDecodeFile(
  filePath: string,
): Promise<{content: AnyJsonType; meta: {path: string; root: string}}> {
  if (!(await fileExists(filePath))) {
    throw new Error(`File not found: ${filePath}`)
  }

  const fileExtension = extname(filePath).toLowerCase()
  const fileContent = await readFile(filePath)

  switch (fileExtension) {
    case '.toml':
      return {content: decodeToml(fileContent), meta: {path: filePath, root: dirname(filePath)}}
    // Add cases for other file types here in the future
    default:
      throw new Error(`Unsupported file type: ${fileExtension}`)
  }
}

export async function includeDemoService(filePath: string): Promise<AnyJsonType> {
  const {content, meta} = await readAndDecodeFile(filePath)
  const contentWithMeta = applyMetaSelectively(content as JsonMapType, meta)
  const processedFiles = new Set<string>([filePath])
  return processLoadedContent(contentWithMeta, dirname(filePath), processedFiles)
}

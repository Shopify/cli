import {readFileSync, fileExistsSync, isDirectorySync} from './fs.js'
import {dirname, joinPath} from './path.js'

// Caches direct import results per file path to avoid redundant file reads and parsing
// when multiple extensions import the same shared code.
const directImportsCache = new Map<string, string[]>()

// Caches filesystem stat results to avoid redundant synchronous I/O.
// Each stat call also triggers outputDebug overhead, so caching here
// avoids both the kernel round-trip and the debug string construction.
const fileExistsCache = new Map<string, boolean>()
const isDirCache = new Map<string, boolean>()

function cachedFileExists(path: string): boolean {
  const cached = fileExistsCache.get(path)
  if (cached !== undefined) return cached
  const result = fileExistsSync(path)
  fileExistsCache.set(path, result)
  return result
}

function cachedIsDir(path: string): boolean {
  const cached = isDirCache.get(path)
  if (cached !== undefined) return cached
  const result = isDirectorySync(path)
  isDirCache.set(path, result)
  return result
}

/**
 * Clears all import-scanning caches (direct imports, recursive results, and filesystem stats).
 * Should be called when watched files change so that rescanning picks up updated imports.
 */
export function clearImportPathsCache(): void {
  directImportsCache.clear()
  fileExistsCache.clear()
  isDirCache.clear()
}

/**
 * Extracts import paths from a source file.
 * Supports JavaScript, TypeScript, and Rust files.
 * Results are cached per file path to avoid redundant I/O.
 *
 * @param filePath - Path to the file to analyze.
 * @returns Array of absolute paths to imported files.
 */
export function extractImportPaths(filePath: string): string[] {
  const cached = directImportsCache.get(filePath)
  if (cached) return cached

  const content = readFileSync(filePath).toString()
  const ext = filePath.substring(filePath.lastIndexOf('.'))

  let result: string[]
  switch (ext) {
    case '.js':
    case '.mjs':
    case '.cjs':
    case '.ts':
    case '.tsx':
    case '.jsx':
      result = extractJSLikeImports(content, filePath)
      break
    case '.rs':
      result = extractRustImports(content, filePath)
      break
    default:
      result = []
  }

  directImportsCache.set(filePath, result)
  return result
}

/**
 * Recursively extracts import paths from a source file and all its dependencies.
 * Supports JavaScript, TypeScript, and Rust files.
 * Handles circular dependencies by tracking visited files.
 *
 * @param filePath - Path to the file to analyze.
 * @param visited - Set of already visited files to prevent infinite recursion.
 * @returns Array of absolute paths to the provided file and all imported files there (including nested imports).
 * @throws If an unexpected error occurs while processing files (not including ENOENT file not found errors).
 */
export function extractImportPathsRecursively(filePath: string, visited: Set<string> = new Set<string>()): string[] {
  if (visited.has(filePath)) {
    return []
  }

  visited.add(filePath)

  const directImports = extractImportPaths(filePath)
  const allImports = [filePath, ...directImports]

  for (const importedFile of directImports) {
    try {
      if (cachedFileExists(importedFile) && !cachedIsDir(importedFile)) {
        const nestedImports = extractImportPathsRecursively(importedFile, visited)
        allImports.push(...nestedImports)
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        continue
      }
      throw error
    }
  }

  return [...new Set(allImports)]
}

/**
 * Returns diagnostic information about the import scanning caches.
 * Useful for debugging performance issues with --verbose.
 *
 * @returns Cache size stats for directImports, fileExists, and isDir.
 */
export function getImportScanningCacheStats(): {directImports: number; fileExists: number; isDir: number} {
  return {
    directImports: directImportsCache.size,
    fileExists: fileExistsCache.size,
    isDir: isDirCache.size,
  }
}

/**
 * Extracts import paths from a JavaScript content.
 *
 * @param content - The content to extract imports from.
 * @param filePath - The path to the file to extract imports from.
 * @returns Array of absolute paths to imported files.
 */
export function extractJSImports(content: string, filePath: string): string[] {
  return extractJSLikeImports(content, filePath)
}

function extractJSLikeImports(content: string, filePath: string): string[] {
  const imports: string[] = []

  // Regular expressions for different import types
  const patterns = [
    // ES6 imports: import ... from './path'
    /import\s+(?:[\s\S]*?)\s+from\s+['"](\.\.?\/[^'"]+)['"]/gm,
    // ES6 side-effect imports: import './path'
    /import\s+['"](\.\.?\/[^'"]+)['"]/g,
    // ES6 exports: export ... from './path'
    /export\s+(?:[\s\S]*?)\s+from\s+['"](\.\.?\/[^'"]+)['"]/gm,
    // Dynamic imports: import('./path')
    /import\s*\(\s*['"](\.\.?\/[^'"]+)['"]\s*\)/g,
    // CommonJS requires: require('./path')
    /require\s*\(\s*['"](\.\.?\/[^'"]+)['"]\s*\)/g,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(content)) !== null) {
      const importPath = match[1]
      if (importPath && importPath.startsWith('.')) {
        const resolvedPath = resolveJSImport(importPath, filePath)
        if (resolvedPath) {
          imports.push(resolvedPath)
        }
      }
    }
  }

  return [...new Set(imports)]
}

function extractRustImports(content: string, filePath: string): string[] {
  const imports: string[] = []

  // Basic Rust mod declarations: mod module_name;
  const modPattern = /^\s*(?:pub\s+)?mod\s+([a-z_][a-z0-9_]*)\s*;/gm

  let match
  while ((match = modPattern.exec(content)) !== null) {
    const modName = match[1]
    if (modName) {
      const modPath = resolveRustModule(modName, filePath)
      if (modPath) {
        imports.push(modPath)
      }
    }
  }

  // Handle #[path = "..."] attributes
  const pathPattern = /#\[path\s*=\s*"([^"]+)"\]/g
  while ((match = pathPattern.exec(content)) !== null) {
    const pathValue = match[1]
    if (pathValue) {
      const resolvedPath = joinPath(dirname(filePath), pathValue)
      if (cachedFileExists(resolvedPath)) {
        imports.push(resolvedPath)
      }
    }
  }

  return [...new Set(imports)]
}

function resolveJSImport(importPath: string, fromFile: string): string | null {
  const basePath = cachedFileExists(fromFile) && cachedIsDir(fromFile) ? fromFile : dirname(fromFile)
  const resolvedPath = joinPath(basePath, importPath)

  if (cachedFileExists(resolvedPath) && cachedIsDir(resolvedPath)) {
    const indexPaths = [
      joinPath(resolvedPath, 'index.js'),
      joinPath(resolvedPath, 'index.ts'),
      joinPath(resolvedPath, 'index.tsx'),
      joinPath(resolvedPath, 'index.jsx'),
    ]

    for (const indexPath of indexPaths) {
      if (cachedFileExists(indexPath) && !cachedIsDir(indexPath)) {
        return indexPath
      }
    }
    return null
  }

  const possiblePaths = [
    resolvedPath,
    `${resolvedPath}.js`,
    `${resolvedPath}.ts`,
    `${resolvedPath}.tsx`,
    `${resolvedPath}.jsx`,
  ]

  for (const path of possiblePaths) {
    if (cachedFileExists(path) && !cachedIsDir(path)) {
      return path
    }
  }

  return null
}

function resolveRustModule(modName: string, fromFile: string): string | null {
  const basePath = dirname(fromFile)
  const possiblePaths = [joinPath(basePath, `${modName}.rs`), joinPath(basePath, modName, 'mod.rs')]

  for (const path of possiblePaths) {
    if (cachedFileExists(path)) {
      return path
    }
  }

  return null
}

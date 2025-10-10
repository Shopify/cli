import {readFileSync, fileExistsSync, isDirectorySync} from './fs.js'
import {dirname, joinPath} from './path.js'

/**
 * Extracts import paths from a source file.
 * Supports JavaScript, TypeScript, and Rust files.
 *
 * @param filePath - Path to the file to analyze.
 * @returns Array of absolute paths to imported files.
 */
export function extractImportPaths(filePath: string): string[] {
  const content = readFileSync(filePath).toString()
  const ext = filePath.substring(filePath.lastIndexOf('.'))

  switch (ext) {
    case '.js':
    case '.mjs':
    case '.cjs':
    case '.ts':
    case '.tsx':
    case '.jsx':
      return extractJSLikeImports(content, filePath)
    case '.rs':
      return extractRustImports(content, filePath)
    default:
      return []
  }
}

/**
 * Recursively extracts import paths from a source file and all its dependencies.
 * Supports JavaScript, TypeScript, and Rust files.
 * Handles circular dependencies by tracking visited files.
 *
 * @param filePath - Path to the file to analyze.
 * @param visited - Set of already visited files to prevent infinite recursion.
 * @returns Array of absolute paths to all imported files (including nested imports).
 * @throws If an unexpected error occurs while processing files (not including ENOENT file not found errors).
 */
export function extractImportPathsRecursively(filePath: string, visited: Set<string> = new Set<string>()): string[] {
  // Avoid processing the same file twice (handles circular dependencies)
  if (visited.has(filePath)) {
    return []
  }

  visited.add(filePath)

  // Get direct imports from this file
  const directImports = extractImportPaths(filePath)
  const allImports = [...directImports]

  // Recursively process each imported file
  for (const importedFile of directImports) {
    try {
      if (fileExistsSync(importedFile) && !isDirectorySync(importedFile)) {
        const nestedImports = extractImportPathsRecursively(importedFile, visited)
        allImports.push(...nestedImports)
      }
    } catch (error) {
      // Rethrow unexpected errors after checking for expected file read errors
      if (error instanceof Error && error.message.includes('ENOENT')) {
        // Skip files that don't exist or can't be read
        continue
      }
      throw error
    }
  }

  // Return unique list of imports
  return [...new Set(allImports)]
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
      if (fileExistsSync(resolvedPath)) {
        imports.push(resolvedPath)
      }
    }
  }

  return [...new Set(imports)]
}

function resolveJSImport(importPath: string, fromFile: string): string | null {
  const basePath = fileExistsSync(fromFile) && isDirectorySync(fromFile) ? fromFile : dirname(fromFile)
  const possiblePaths = [
    joinPath(basePath, importPath),
    joinPath(basePath, `${importPath}.js`),
    joinPath(basePath, `${importPath}.ts`),
    joinPath(basePath, `${importPath}.tsx`),
    joinPath(basePath, `${importPath}.jsx`),
    joinPath(basePath, importPath, 'index.js'),
    joinPath(basePath, importPath, 'index.ts'),
    joinPath(basePath, importPath, 'index.tsx'),
  ]

  for (const path of possiblePaths) {
    if (fileExistsSync(path)) {
      return path
    }
  }

  return null
}

function resolveRustModule(modName: string, fromFile: string): string | null {
  const basePath = dirname(fromFile)
  const possiblePaths = [joinPath(basePath, `${modName}.rs`), joinPath(basePath, modName, 'mod.rs')]

  for (const path of possiblePaths) {
    if (fileExistsSync(path)) {
      return path
    }
  }

  return null
}

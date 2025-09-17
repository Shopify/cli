import {readFileSync, fileExistsSync} from './fs.js'
import {dirname, joinPath} from './path.js'
import {outputDebug} from './output.js'
import Parser from 'tree-sitter'
import javascript from 'tree-sitter-javascript'
// @ts-expect-error - tree-sitter-typescript doesn't provide type declarations for subpath imports
import typescript from 'tree-sitter-typescript/bindings/node/typescript.js'
// @ts-expect-error - tree-sitter-typescript doesn't provide type declarations for subpath imports
import tsx from 'tree-sitter-typescript/bindings/node/tsx.js'
import rust from 'tree-sitter-rust'

// Initialize parsers at module load time
const jsParser = new Parser()
jsParser.setLanguage(javascript)

const tsParser = new Parser()
tsParser.setLanguage(typescript)

const tsxParser = new Parser()
tsxParser.setLanguage(tsx)

const rustParser = new Parser()
rustParser.setLanguage(rust)

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
      return extractJSImports(content, filePath)
    case '.ts':
      return extractTSImports(content, filePath)
    case '.tsx':
    case '.jsx':
      return extractTSXImports(content, filePath)
    case '.rs':
      return extractRustImports(content, filePath)
    default:
      return []
  }
}

function extractJSImports(content: string, filePath: string): string[] {
  if (!jsParser) return []
  const tree = jsParser.parse(content)
  return extractJSLikeImports(tree, content, filePath, jsParser)
}

function extractTSImports(content: string, filePath: string): string[] {
  if (!tsParser) return []
  const tree = tsParser.parse(content)
  return extractJSLikeImports(tree, content, filePath, tsParser)
}

function extractTSXImports(content: string, filePath: string): string[] {
  if (!tsxParser) return []
  const tree = tsxParser.parse(content)
  return extractJSLikeImports(tree, content, filePath, tsxParser)
}

function extractJSLikeImports(tree: Parser.Tree, content: string, filePath: string, parser: Parser): string[] {
  const imports: string[] = []

  try {
    // Query for various import types
    const query = new Parser.Query(
      parser.getLanguage(),
      `
      ; ES6 imports
      (import_statement
        source: (string (string_fragment) @import))

      ; Dynamic imports
      (call_expression
        function: (import)
        arguments: (arguments (string (string_fragment) @import)))

      ; CommonJS require
      (call_expression
        function: (identifier) @fn (#eq? @fn "require")
        arguments: (arguments (string (string_fragment) @import)))

      ; Re-exports
      (export_statement
        source: (string (string_fragment) @import))
    `,
    )

    const captures = query.captures(tree.rootNode)

    for (const capture of captures) {
      if (capture.name === 'import') {
        const importPath = content.slice(capture.node.startIndex, capture.node.endIndex)
        if (importPath.startsWith('.')) {
          // Relative import - resolve it
          const resolvedPath = resolveJSImport(importPath, filePath)
          if (resolvedPath) {
            imports.push(resolvedPath)
          }
        }
      }
    }
  } catch (error) {
    outputDebug(`Error parsing JS/TS imports: ${error}`)
    throw error
  }

  return [...new Set(imports)]
}

function extractRustImports(content: string, filePath: string): string[] {
  if (!rustParser) return []
  const tree = rustParser.parse(content)
  const imports: string[] = []

  try {
    // Query for Rust imports and modules
    const query = new Parser.Query(
      rustParser.getLanguage(),
      `
      ; all mod declarations
      (mod_item
        name: (identifier) @mod_name)

      ; #[path = "..."] attributes
      (attribute_item
        (attribute
          (identifier) @attr_name
          (string_literal) @path_value)
        (#eq? @attr_name "path"))
    `,
    )

    const captures = query.captures(tree.rootNode)

    for (const capture of captures) {
      const text = content.slice(capture.node.startIndex, capture.node.endIndex)

      switch (capture.name) {
        case 'mod_name': {
          // Resolve mod declaration to file path
          const modPath = resolveRustModule(text, filePath)
          if (modPath) {
            imports.push(modPath)
          }
          break
        }
        case 'path_value': {
          // Handle explicit path attribute
          const cleanPath = text.replace(/['"]/g, '')
          const resolvedPath = joinPath(dirname(filePath), cleanPath)
          if (fileExistsSync(resolvedPath)) {
            imports.push(resolvedPath)
          }
          break
        }
      }
    }
  } catch (error) {
    outputDebug(`Error parsing Rust imports: ${error}`)
    throw error
  }

  return [...new Set(imports)]
}

function resolveJSImport(importPath: string, fromFile: string): string | null {
  const basePath = dirname(fromFile)
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

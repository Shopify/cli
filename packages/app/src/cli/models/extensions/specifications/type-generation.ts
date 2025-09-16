import {fileExists, findPathUp, readFileSync} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath, relativizePath, resolvePath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import ts from 'typescript'
import {createRequire} from 'module'

const require = createRequire(import.meta.url)

export function parseApiVersion(apiVersion: string): {year: number; month: number} | null {
  const [year, month] = apiVersion.split('-')
  if (!year || !month) {
    return null
  }
  return {year: parseInt(year, 10), month: parseInt(month, 10)}
}

function loadTsConfig(startPath: string): {compilerOptions: ts.CompilerOptions; configPath: string | undefined} {
  const configPath = ts.findConfigFile(startPath, ts.sys.fileExists.bind(ts.sys), 'tsconfig.json')
  if (!configPath) {
    return {compilerOptions: {}, configPath: undefined}
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile.bind(ts.sys))
  if (configFile.error) {
    return {compilerOptions: {}, configPath}
  }

  const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, dirname(configPath))

  return {compilerOptions: parsedConfig.options, configPath}
}

async function fallbackResolve(importPath: string, baseDir: string): Promise<string | null> {
  // Only handle relative imports in fallback
  if (!importPath.startsWith('./') && !importPath.startsWith('../')) {
    return null
  }

  const resolvedPath = resolvePath(baseDir, importPath)
  const extensions = ['', '.js', '.jsx', '.ts', '.tsx']

  // Try different extensions
  for (const ext of extensions) {
    const pathWithExt = resolvedPath + ext
    // eslint-disable-next-line no-await-in-loop
    if ((await fileExists(pathWithExt)) && !pathWithExt.includes('node_modules')) {
      return pathWithExt
    }
  }

  // Try as directory with index files
  for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
    const indexPath = joinPath(resolvedPath, `index${ext}`)
    // eslint-disable-next-line no-await-in-loop
    if ((await fileExists(indexPath)) && !indexPath.includes('node_modules')) {
      return indexPath
    }
  }

  return null
}

async function parseAndResolveImports(filePath: string): Promise<string[]> {
  try {
    const content = readFileSync(filePath).toString()
    const resolvedPaths: string[] = []

    // Load TypeScript configuration once
    const {compilerOptions} = loadTsConfig(filePath)

    // Determine script kind based on file extension
    let scriptKind = ts.ScriptKind.JSX
    if (filePath.endsWith('.ts')) {
      scriptKind = ts.ScriptKind.TS
    } else if (filePath.endsWith('.tsx')) {
      scriptKind = ts.ScriptKind.TSX
    }

    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, scriptKind)

    const processedImports = new Set<string>()
    const importPaths: string[] = []

    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        importPaths.push(node.moduleSpecifier.text)
      } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const firstArg = node.arguments[0]
        if (firstArg && ts.isStringLiteral(firstArg)) {
          importPaths.push(firstArg.text)
        }
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        importPaths.push(node.moduleSpecifier.text)
      }

      ts.forEachChild(node, visit)
    }

    visit(sourceFile)

    for (const importPath of importPaths) {
      // Skip if already processed
      if (!importPath || processedImports.has(importPath)) {
        continue
      }

      processedImports.add(importPath)

      // Use TypeScript's module resolution to resolve potential "paths" configurations
      const resolvedModule = ts.resolveModuleName(importPath, filePath, compilerOptions, ts.sys)
      if (resolvedModule.resolvedModule?.resolvedFileName) {
        const resolvedPath = resolvedModule.resolvedModule.resolvedFileName

        if (!resolvedPath.includes('node_modules')) {
          resolvedPaths.push(resolvedPath)
        }
      } else {
        // Fallback to manual resolution for edge cases
        // eslint-disable-next-line no-await-in-loop
        const fallbackPath = await fallbackResolve(importPath, dirname(filePath))
        if (fallbackPath) {
          resolvedPaths.push(fallbackPath)
        }
      }
    }

    return resolvedPaths
  } catch (error) {
    // Re-throw AbortError as-is, wrap other errors
    if (error instanceof AbortError) {
      throw error
    }
    return []
  }
}

export async function findAllImportedFiles(filePath: string, visited = new Set<string>()): Promise<string[]> {
  if (visited.has(filePath)) {
    return []
  }

  visited.add(filePath)
  const resolvedPaths = await parseAndResolveImports(filePath)

  const allFiles = [...resolvedPaths]

  // Recursively find imports from the resolved files
  for (const resolvedPath of resolvedPaths) {
    // eslint-disable-next-line no-await-in-loop
    const nestedImports = await findAllImportedFiles(resolvedPath, visited)
    allFiles.push(...nestedImports)
  }

  return [...new Set(allFiles)]
}

export function createTypeDefinition(
  fullPath: string,
  typeFilePath: string,
  targets: string[],
  apiVersion: string,
): string | null {
  try {
    // Validate that all targets can be resolved
    for (const target of targets) {
      try {
        require.resolve(`@shopify/ui-extensions/${target}`, {paths: [fullPath, typeFilePath]})
      } catch (_) {
        const {year, month} = parseApiVersion(apiVersion) ?? {year: 2025, month: 10}
        // Throw specific error for the target that failed, matching the original getSharedTypeDefinition behavior
        throw new AbortError(
          `Type reference for ${target} could not be found. You might be using the wrong @shopify/ui-extensions version.`,
          `Fix the error by ensuring you have the correct version of @shopify/ui-extensions, for example ~${year}.${month}.0, in your dependencies.`,
        )
      }
    }

    const relativePath = relativizePath(fullPath, dirname(typeFilePath))

    if (targets.length === 1) {
      const target = targets[0] ?? ''
      return `//@ts-ignore\ndeclare module './${relativePath}' {\n  const shopify: import('@shopify/ui-extensions/${target}').Api;\n  const globalThis: { shopify: typeof shopify };\n}\n`
    } else if (targets.length > 1) {
      const unionType = targets.map((target) => `    import('@shopify/ui-extensions/${target}').Api`).join(' |\n')
      return `//@ts-ignore\ndeclare module './${relativePath}' {\n  const shopify: \n${unionType};\n  const globalThis: { shopify: typeof shopify };\n}\n`
    }

    return null
  } catch (error) {
    // Re-throw AbortError as-is, wrap other errors
    if (error instanceof AbortError) {
      throw error
    }
    const {year, month} = parseApiVersion(apiVersion) ?? {year: 2025, month: 10}
    throw new AbortError(
      `Type reference could not be found. You might be using the wrong @shopify/ui-extensions version.`,
      `Fix the error by ensuring you have the correct version of @shopify/ui-extensions, for example ~${year}.${month}.0, in your dependencies.`,
    )
  }
}

export async function findNearestTsConfigDir(
  fromFile: string,
  extensionDirectory: string,
): Promise<string | undefined> {
  const fromDirectory = dirname(fromFile)
  const tsconfigPath = await findPathUp('tsconfig.json', {cwd: fromDirectory, type: 'file', stopAt: extensionDirectory})

  if (tsconfigPath) {
    return dirname(tsconfigPath)
  }
}

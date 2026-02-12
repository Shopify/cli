import {fileExists, findPathUp, readFileSync} from '@shopify/cli-kit/shared/node/fs'
import {dirname, joinPath, relativizePath, resolvePath} from '@shopify/cli-kit/shared/node/path'
import {AbortError} from '@shopify/cli-kit/shared/node/error'
import ts from 'typescript'
import {compile} from 'json-schema-to-typescript'
import {pascalize} from '@shopify/cli-kit/shared/common/string'
import {zod} from '@shopify/cli-kit/shared/node/schema'
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

interface CreateTypeDefinitionOptions {
  fullPath: string
  typeFilePath: string
  targets: string[]
  apiVersion: string
  toolsTypeDefinition?: string
}

/**
 * Builds the shopify API type based on targets and optional tools type.
 * Returns null if no targets are provided.
 */
function buildShopifyType(targets: string[], toolsTypeDefinition?: string): string | null {
  const toolsSuffix = toolsTypeDefinition ? ' & { tools: ShopifyTools }' : ''

  if (targets.length === 1) {
    const target = targets[0] ?? ''
    return `import('@shopify/ui-extensions/${target}').Api${toolsSuffix}`
  }

  if (targets.length > 1) {
    const unionType = targets.map((target) => `import('@shopify/ui-extensions/${target}').Api`).join(' | ')
    return `(${unionType})${toolsSuffix}`
  }

  return null
}

export function createTypeDefinition({
  fullPath,
  typeFilePath,
  targets,
  apiVersion,
  toolsTypeDefinition,
}: CreateTypeDefinitionOptions): string | null {
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

    const shopifyType = buildShopifyType(targets, toolsTypeDefinition)
    if (!shopifyType) return null

    const lines = [
      '//@ts-ignore',
      `declare module './${relativePath}' {`,
      ...(toolsTypeDefinition ? [`  ${toolsTypeDefinition}`] : []),
      `  const shopify: ${shopifyType};`,
      '  const globalThis: { shopify: typeof shopify };',
      '}',
      '',
    ]

    return lines.join('\n')
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
  const tsconfigPath = await findPathUp('tsconfig.json', {cwd: fromDirectory, type: 'file'})

  if (tsconfigPath) {
    // Normalize both paths for cross-platform comparison
    const normalizedTsconfigPath = resolvePath(tsconfigPath)
    const normalizedExtensionDirectory = resolvePath(extensionDirectory)

    if (normalizedTsconfigPath.startsWith(normalizedExtensionDirectory)) {
      return dirname(tsconfigPath)
    }
  }
}

interface ToolDefinition {
  name: string
  description: string
  inputSchema: object
  outputSchema?: object
}
const ToolDefinitionSchema: zod.ZodType<ToolDefinition> = zod.object({
  name: zod.string(),
  description: zod.string(),
  inputSchema: zod.object({}).passthrough(),
  outputSchema: zod.object({}).passthrough().optional(),
})

export const ToolsFileSchema = zod.array(ToolDefinitionSchema)

/**
 * Generates TypeScript types for shopify.tools.register based on tool definitions
 * @param tools - Array of tool definitions from tools.json
 * @returns TypeScript declaration string
 */
export async function createToolsTypeDefinition(tools: ToolDefinition[]): Promise<string> {
  if (tools.length === 0) return ''

  const toolNames = new Set<string>()
  const typePromises = tools.map(async (tool) => {
    // Tool names must be unique within a tools file
    if (toolNames.has(tool.name)) {
      throw new AbortError(
        `Tool name "${tool.name}" is defined multiple times. Tool names must be unique within a tools file.`,
      )
    }
    toolNames.add(tool.name)

    // Generate input type definition
    const inputTypeName = pascalize(`${tool.name}Input`)
    const inputType = await formatJsonSchemaType(inputTypeName, tool.inputSchema)

    // Generate output type definition
    const outputTypeName = pascalize(`${tool.name}Output`)
    const outputType = await formatJsonSchemaType(outputTypeName, tool.outputSchema)

    return {
      name: tool.name,
      description: tool.description,
      inputType,
      outputType,
      inputTypeName,
      outputTypeName,
    }
  })

  const types = await Promise.all(typePromises)

  const toolRegistrations = types
    .map(({name, description, inputTypeName, outputTypeName}) => {
      const formattedDescription = description
        .replace(/\*\//g, '*\\/')
        .split('\n')
        .map((line) => `   * ${line}`)
        .join('\n')
      return `  /**\n${formattedDescription}\n   */\n  register(name: '${name}', handler: (input: ${inputTypeName}) => ${outputTypeName} | Promise<${outputTypeName}>);`
    })
    .join('\n')

  return `${types
    .map(({inputType, outputType}) => `${inputType}\n${outputType}`)
    .join('\n')}\ninterface ShopifyTools {\n${toolRegistrations}\n}\n`
}

async function formatJsonSchemaType(name: string, schema?: object): Promise<string> {
  const outputType = schema ? await compile(schema, name, {bannerComment: ''}) : `type ${name} = unknown`
  // The json-schema-to-typescript library adds an export keyword to the type definition, we need to remove it
  return outputType.startsWith('export ') ? outputType.slice(7) : outputType
}

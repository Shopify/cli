import {fileExists, findPathUp, readFileSync} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath, relativizePath, resolvePath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {compile} from 'json-schema-to-typescript'
import {pascalize} from '@shopify/cli-kit/common/string'
import {zod} from '@shopify/cli-kit/node/schema'
import {createRequire} from 'module'
import type ts from 'typescript'

async function loadTypeScript(): Promise<typeof ts> {
  // typescript is CJS; dynamic import wraps it as { default: ... }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import('typescript')
  return mod.default ?? mod
}

const require = createRequire(import.meta.url)
const uiExtensionsPackage = '@shopify/ui-extensions'

function getGeneratedTypesHelperSurface(target: string): string {
  const domain = target.toLowerCase().replace(/(::|\.).+$/, '')

  switch (domain) {
    case 'purchase':
      return 'checkout'
    case 'pos':
      return 'point-of-sale'
    default:
      return domain
  }
}

export function getGeneratedTypesHelperImportPath(targets: string[]): string {
  const target = targets[0]
  if (!target) return uiExtensionsPackage

  return `${uiExtensionsPackage}/${getGeneratedTypesHelperSurface(target)}`
}

export function parseApiVersion(apiVersion: string): {year: number; month: number} | null {
  const [year, month] = apiVersion.split('-')
  if (!year || !month) {
    return null
  }
  return {year: parseInt(year, 10), month: parseInt(month, 10)}
}

async function loadTsConfig(
  startPath: string,
): Promise<{compilerOptions: ts.CompilerOptions; configPath: string | undefined}> {
  const ts = await loadTypeScript()
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
    const ts = await loadTypeScript()
    const content = readFileSync(filePath).toString()
    const resolvedPaths: string[] = []

    // Load TypeScript configuration once
    const {compilerOptions} = await loadTsConfig(filePath)

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
  intentsTypeDefinition?: string
}

interface ShopifyTypeOptions {
  includesTools: boolean
  includesIntents: boolean
}

/**
 * Returns true when the resolved target declaration file re-exports a
 * `ShopifyGlobal` type. Used to decide whether the `shopify` binding should be
 * typed as `Api & ShopifyGlobal` or just `Api`.
 *
 * Uses the TS compiler API to avoid false positives from comments or string
 * literals that happen to contain the word "ShopifyGlobal".
 */
async function targetExportsShopifyGlobal(targetDtsPath: string): Promise<boolean> {
  let content: string
  try {
    content = readFileSync(targetDtsPath).toString()
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }

  const ts = await loadTypeScript()
  const sourceFile = ts.createSourceFile(targetDtsPath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

  let found = false
  const visit = (node: ts.Node): void => {
    if (found) return
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const specifier of node.exportClause.elements) {
        // Match on the exported (public) name. For `export {ShopifyGlobal}`,
        // that's specifier.name. For `export {Foo as ShopifyGlobal}`,
        // specifier.name is still 'ShopifyGlobal' (the public alias); the
        // internal/local name 'Foo' lives on specifier.propertyName.
        if (specifier.name.text === 'ShopifyGlobal') {
          found = true
          return
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return found
}

/**
 * Builds the base shopify API type based on targets and their resolved .d.ts paths.
 *
 * If a target re-exports `ShopifyGlobal`, the emitted type includes
 * `import('<target>').Api & import('<target>').ShopifyGlobal` so consumers
 * retain access to both the target's data surface and host-level APIs
 * (e.g. `shopify.addEventListener`). Otherwise emits just `.Api`.
 *
 * Returns null if no targets are provided.
 */
async function buildBaseShopifyType(
  targets: string[],
  resolvedTargetPaths: Map<string, string>,
): Promise<string | null> {
  const typeForTarget = async (target: string): Promise<string> => {
    const base = `import('@shopify/ui-extensions/${target}').Api`
    const dtsPath = resolvedTargetPaths.get(target)
    if (dtsPath && (await targetExportsShopifyGlobal(dtsPath))) {
      return `${base} & import('@shopify/ui-extensions/${target}').ShopifyGlobal`
    }
    return base
  }

  if (targets.length === 1) {
    return typeForTarget(targets[0] ?? '')
  }

  if (targets.length > 1) {
    const typesForTargets = await Promise.all(targets.map(typeForTarget))
    return `(${typesForTargets.join(' | ')})`
  }

  return null
}

/**
 * Builds the shopify API type based on targets and optional generated tool / intent types.
 *
 * Generated tools and intents are layered on top of the base target type via
 * wrapper utility types.
 *
 * Returns null if no targets are provided.
 */
async function buildShopifyType(
  targets: string[],
  resolvedTargetPaths: Map<string, string>,
  {includesTools, includesIntents}: ShopifyTypeOptions,
  generatedTypesHelperImportPath: string,
): Promise<string | null> {
  const baseShopifyType = await buildBaseShopifyType(targets, resolvedTargetPaths)
  if (!baseShopifyType) return null

  if (!includesTools && !includesIntents) {
    return baseShopifyType
  }

  let shopifyType = baseShopifyType

  if (includesIntents) {
    shopifyType = `import('${generatedTypesHelperImportPath}').WithGeneratedIntents<${shopifyType}, ShopifyGeneratedIntentVariants>`
  }

  if (includesTools) {
    shopifyType = `import('${generatedTypesHelperImportPath}').WithGeneratedTools<${shopifyType}, ShopifyTools>`
  }

  return shopifyType
}

export async function createTypeDefinition({
  fullPath,
  typeFilePath,
  targets,
  apiVersion,
  toolsTypeDefinition,
  intentsTypeDefinition,
}: CreateTypeDefinitionOptions): Promise<string | null> {
  try {
    const resolvedTargetPaths = new Map<string, string>()
    const includesTools = Boolean(toolsTypeDefinition)
    const includesIntents = Boolean(intentsTypeDefinition)

    // Validate that all targets can be resolved, and capture the resolved .d.ts
    // path so buildShopifyType can inspect it for ShopifyGlobal exports.
    for (const target of targets) {
      try {
        const resolved = require.resolve(`@shopify/ui-extensions/${target}`, {
          paths: [fullPath, typeFilePath],
        })
        resolvedTargetPaths.set(target, resolved)
      } catch (_) {
        const {year, month} = parseApiVersion(apiVersion) ?? {year: 2025, month: 10}
        throw new AbortError(
          `Type reference for ${target} could not be found. You might be using the wrong @shopify/ui-extensions version.`,
          `Fix the error by ensuring you have the correct version of @shopify/ui-extensions, for example ~${year}.${month}.0, in your dependencies.`,
        )
      }
    }

    const generatedTypesHelperImportPath = getGeneratedTypesHelperImportPath(targets)

    if (includesTools || includesIntents) {
      try {
        require.resolve(generatedTypesHelperImportPath, {paths: [fullPath, typeFilePath]})
      } catch (_) {
        const {year, month} = parseApiVersion(apiVersion) ?? {year: 2025, month: 10}
        throw new AbortError(
          `Type reference for ${generatedTypesHelperImportPath} could not be found. You might be using the wrong @shopify/ui-extensions version.`,
          `Fix the error by ensuring you have the correct version of @shopify/ui-extensions, for example ~${year}.${month}.0, in your dependencies.`,
        )
      }
    }

    const relativePath = relativizePath(fullPath, dirname(typeFilePath))
    const shopifyType = await buildShopifyType(
      targets,
      resolvedTargetPaths,
      {includesTools, includesIntents},
      generatedTypesHelperImportPath,
    )
    if (!shopifyType) return null

    const lines = [
      '//@ts-ignore',
      `declare module './${relativePath}' {`,
      ...(toolsTypeDefinition ? [toolsTypeDefinition] : []),
      ...(intentsTypeDefinition ? [intentsTypeDefinition] : []),
      `  const shopify: ${shopifyType};`,
      '  const globalThis: { shopify: typeof shopify };',
      '}',
      '',
    ]

    return lines.join('\n')
  } catch (error) {
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

interface IntentTypeDefinition {
  action: string
  type: string
  inputSchema: object
  valueSchema?: object
  outputSchema?: object
}

interface IntentSchemaFile {
  value?: object
  inputSchema: object
  outputSchema?: object
}

export const IntentSchemaFileSchema: zod.ZodType<IntentSchemaFile> = zod.object({
  value: zod.object({}).passthrough().optional(),
  inputSchema: zod.object({}).passthrough(),
  outputSchema: zod.object({}).passthrough().optional(),
})

function intentTypeBaseName(intent: Pick<IntentTypeDefinition, 'action' | 'type'>): string {
  return pascalize(`${intent.action} ${intent.type}`.replace(/[^a-zA-Z0-9]+/g, ' '))
}

/**
 * Generates TypeScript types for shopify.intents.request and shopify.intents.response.ok
 * based on intent schema definitions.
 */
export async function createIntentsTypeDefinition(
  intents: IntentTypeDefinition[],
  {generatedTypesHelperImportPath}: {generatedTypesHelperImportPath: string},
): Promise<string> {
  if (intents.length === 0) return ''

  const intentKeys = new Set<string>()
  const typePromises = intents.map(async (intent) => {
    const intentKey = `${intent.action}:${intent.type}`
    if (intentKeys.has(intentKey)) {
      throw new AbortError(`Intent "${intentKey}" is defined multiple times. Intents must be unique within a target.`)
    }
    intentKeys.add(intentKey)

    const typeBaseName = intentTypeBaseName(intent)
    const inputTypeName = `${typeBaseName}IntentInput`
    const valueTypeName = `${typeBaseName}IntentValue`
    const outputTypeName = `${typeBaseName}IntentOutput`
    const requestTypeName = `${typeBaseName}IntentRequest`

    const inputType = await formatJsonSchemaType(inputTypeName, intent.inputSchema)
    const valueType = await formatJsonSchemaType(valueTypeName, intent.valueSchema)
    const outputType = await formatJsonSchemaType(outputTypeName, intent.outputSchema)

    const requestType = `interface ${requestTypeName} {
  action: ${JSON.stringify(intent.action)};
  type: ${JSON.stringify(intent.type)};
  data: ${inputTypeName};
  value?: ${valueTypeName};
}`

    return {
      inputType,
      valueType,
      outputType,
      requestType,
      requestTypeName,
      outputTypeName,
    }
  })

  const types = await Promise.all(typePromises)

  const generatedIntents = types
    .map(({requestTypeName, outputTypeName}) => {
      return `  | import('${generatedTypesHelperImportPath}').ShopifyGeneratedIntentVariant<${requestTypeName}, ${outputTypeName}>`
    })
    .join('\n')

  return `${types
    .map(
      ({inputType, valueType, outputType, requestType}) => `${inputType}\n${valueType}\n${outputType}\n${requestType}`,
    )
    .join('\n\n')}\n\ntype ShopifyGeneratedIntentVariants =\n${generatedIntents}\n`
}

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
      return `  /**\n${formattedDescription}\n   */\n  register(name: '${name}', handler: (input: ${inputTypeName}) => ${outputTypeName} | Promise<${outputTypeName}>): () => void;`
    })
    .join('\n')

  return `${types
    .map(({inputType, outputType}) => `${inputType}\n${outputType}`)
    .join('\n')}\ninterface ShopifyTools {\n${toolRegistrations}\n}\n`
}

function renameGeneratedType(typeDefinition: string, name: string): string {
  return typeDefinition.replace(/^(interface|type|enum)\s+[A-Za-z0-9_]+/, `$1 ${name}`)
}

async function formatJsonSchemaType(name: string, schema?: object): Promise<string> {
  if (!schema) return `type ${name} = unknown`

  const outputType = await compile(schema, name, {bannerComment: ''})
  const normalizedOutputType = outputType.startsWith('export ') ? outputType.slice(7) : outputType

  return renameGeneratedType(normalizedOutputType, name)
}

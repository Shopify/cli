import {Asset, AssetIdentifier, ExtensionFeature, createExtensionSpecification} from '../specification.js'
import {NewExtensionPointSchemaType, NewExtensionPointsSchema, BaseSchema, MetafieldSchema} from '../schemas.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {getExtensionPointTargetSurface} from '../../../services/dev/extension/utilities.js'
import {ExtensionInstance} from '../extension-instance.js'
import {err, ok, Result} from '@shopify/cli-kit/node/result'
import {fileExists, findPathUp, readFileSync} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath, relativizePath, resolvePath} from '@shopify/cli-kit/node/path'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {zod} from '@shopify/cli-kit/node/schema'
import {AbortError} from '@shopify/cli-kit/node/error'
import ts from 'typescript'
import {init, parse} from 'es-module-lexer'
import {createRequire} from 'module'

const require = createRequire(import.meta.url)

const dependency = '@shopify/checkout-ui-extensions'

const validatePoints = (config: {extension_points?: unknown[]; targeting?: unknown[]}) => {
  return config.extension_points !== undefined || config.targeting !== undefined
}

export interface BuildManifest {
  assets: {
    // Main asset is always required
    [AssetIdentifier.Main]: {
      filepath: string
      module?: string
    }
  } & {
    [key in AssetIdentifier]?: {
      filepath: string
      module?: string
    }
  }
}

const missingExtensionPointsMessage = 'No extension targets defined, add a `targeting` field to your configuration'

export type UIExtensionSchemaType = zod.infer<typeof UIExtensionSchema>

export const UIExtensionSchema = BaseSchema.extend({
  name: zod.string(),
  type: zod.literal('ui_extension'),
  extension_points: NewExtensionPointsSchema.optional(),
  targeting: NewExtensionPointsSchema.optional(),
  metafields: zod.array(MetafieldSchema).optional(),
})
  .refine((config) => validatePoints(config), missingExtensionPointsMessage)
  .transform((config) => {
    const extensionPoints = (config.targeting ?? config.extension_points ?? []).map((targeting) => {
      const buildManifest: BuildManifest = {
        assets: {
          [AssetIdentifier.Main]: {
            filepath: `${config.handle}.js`,
            module: targeting.module,
          },
          ...(targeting.should_render?.module
            ? {
                [AssetIdentifier.ShouldRender]: {
                  filepath: `${config.handle}-conditions.js`,
                  module: targeting.should_render.module,
                },
              }
            : null),
        },
      }

      return {
        target: targeting.target,
        module: targeting.module,
        metafields: targeting.metafields ?? config.metafields ?? [],
        default_placement_reference: targeting.default_placement,
        urls: targeting.urls ?? {},
        capabilities: targeting.capabilities,
        preloads: targeting.preloads ?? {},
        build_manifest: buildManifest,
      }
    })
    return {...config, extension_points: extensionPoints}
  })

const uiExtensionSpec = createExtensionSpecification({
  identifier: 'ui_extension',
  dependency,
  schema: UIExtensionSchema,
  buildConfig: {mode: 'ui'},
  appModuleFeatures: (config) => {
    const basic: ExtensionFeature[] = ['ui_preview', 'esbuild', 'generates_source_maps']
    const needsCart =
      config?.extension_points?.find((extensionPoint) => {
        return getExtensionPointTargetSurface(extensionPoint.target) === 'checkout'
      }) !== undefined
    return needsCart ? [...basic, 'cart_url'] : basic
  },
  validate: async (config, path, directory) => {
    return validateUIExtensionPointConfig(directory, config.extension_points, path)
  },
  deployConfig: async (config, directory) => {
    const transformedExtensionPoints = config.extension_points.map(addDistPathToAssets)

    return {
      api_version: config.api_version,
      extension_points: transformedExtensionPoints,
      capabilities: config.capabilities,
      name: config.name,
      description: config.description,
      settings: config.settings,
      localization: await loadLocalesConfig(directory, config.type),
    }
  },
  getBundleExtensionStdinContent: (config) => {
    const shouldIncludeShopifyExtend = isRemoteDomExtension(config)
    const main = config.extension_points
      .map(({target, module}, index) => {
        if (shouldIncludeShopifyExtend) {
          return `import Target_${index} from '${module}';shopify.extend('${target}', (...args) => Target_${index}(...args));`
        }
        return `import '${module}';`
      })
      .join('\n')

    const assets: {[key: string]: Asset} = {}
    config.extension_points.forEach((extensionPoint) => {
      // Start of Selection
      Object.entries(extensionPoint.build_manifest.assets).forEach(([identifier, asset]) => {
        if (identifier === AssetIdentifier.Main) {
          return
        }

        assets[identifier] = {
          identifier: identifier as AssetIdentifier,
          outputFileName: asset.filepath,
          content: shouldIncludeShopifyExtend
            ? `import shouldRender from '${asset.module}';shopify.extend('${getShouldRenderTarget(
                extensionPoint.target,
              )}', (...args) => shouldRender(...args));`
            : `import '${asset.module}'`,
        }
      })
    })

    const assetsArray = Object.values(assets)
    return {
      main,
      ...(assetsArray.length ? {assets: assetsArray} : {}),
    }
  },
  hasExtensionPointTarget: (config, requestedTarget) => {
    return (
      config.extension_points.find((extensionPoint) => {
        return extensionPoint.target === requestedTarget
      }) !== undefined
    )
  },
  contributeToSharedTypeFile: async (extension, typeDefinitionsByFile) => {
    if (!isRemoteDomExtension(extension.configuration)) {
      return
    }

    const {configuration} = extension

    // Track all files and their associated targets
    const fileToTargetsMap = new Map<string, string[]>()

    // First pass: collect all entry point files and their targets
    for await (const extensionPoint of configuration.extension_points) {
      const fullPath = joinPath(extension.directory, extensionPoint.module)
      const exists = await fileExists(fullPath)
      if (!exists) continue

      // Add main module
      const currentTargets = fileToTargetsMap.get(fullPath) ?? []
      currentTargets.push(extensionPoint.target)
      fileToTargetsMap.set(fullPath, currentTargets)

      // Add should render module if present
      if (extensionPoint.build_manifest.assets[AssetIdentifier.ShouldRender]?.module) {
        const shouldRenderPath = joinPath(
          extension.directory,
          extensionPoint.build_manifest.assets[AssetIdentifier.ShouldRender].module,
        )
        const shouldRenderExists = await fileExists(shouldRenderPath)
        if (shouldRenderExists) {
          const shouldRenderTargets = fileToTargetsMap.get(shouldRenderPath) ?? []
          shouldRenderTargets.push(getShouldRenderTarget(extensionPoint.target))
          fileToTargetsMap.set(shouldRenderPath, shouldRenderTargets)
        }
      }
    }

    // Second pass: find all imported files from each entry point
    for await (const extensionPoint of configuration.extension_points) {
      const fullPath = joinPath(extension.directory, extensionPoint.module)
      const exists = await fileExists(fullPath)
      if (!exists) continue

      // Find all imported files recursively
      const importedFiles = await findAllImportedFiles(fullPath)

      // Associate imported files with this extension point's target
      for (const importedFile of importedFiles) {
        const currentTargets = fileToTargetsMap.get(importedFile) ?? []
        currentTargets.push(extensionPoint.target)
        fileToTargetsMap.set(importedFile, currentTargets)
      }

      // Also process should_render imports if present
      if (extensionPoint.build_manifest.assets[AssetIdentifier.ShouldRender]?.module) {
        const shouldRenderPath = joinPath(
          extension.directory,
          extensionPoint.build_manifest.assets[AssetIdentifier.ShouldRender].module,
        )
        const shouldRenderExists = await fileExists(shouldRenderPath)
        if (shouldRenderExists) {
          const shouldRenderImports = await findAllImportedFiles(shouldRenderPath)
          for (const importedFile of shouldRenderImports) {
            const currentTargets = fileToTargetsMap.get(importedFile) ?? []
            currentTargets.push(getShouldRenderTarget(extensionPoint.target))
            fileToTargetsMap.set(importedFile, currentTargets)
          }
        }
      }
    }

    // Third pass: generate type definitions for all files
    for await (const [filePath, targets] of fileToTargetsMap.entries()) {
      const tsConfigDir = await findNearestTsConfigDir(filePath, extension.directory)
      if (!tsConfigDir) continue

      const typeFilePath = joinPath(tsConfigDir, 'shopify.d.ts')

      // Remove duplicates from targets
      const uniqueTargets = [...new Set(targets)]

      try {
        const typeDefinition = createTypeDefinition(filePath, typeFilePath, uniqueTargets, configuration.api_version)
        if (typeDefinition) {
          const currentTypes = typeDefinitionsByFile.get(typeFilePath) ?? new Set<string>()
          currentTypes.add(typeDefinition)
          typeDefinitionsByFile.set(typeFilePath, currentTypes)
        }
      } catch (error) {
        // Only throw if this is an entry point file (required)
        const isEntryPoint = configuration.extension_points.some(
          (ep) =>
            joinPath(extension.directory, ep.module) === filePath ||
            (ep.build_manifest.assets[AssetIdentifier.ShouldRender]?.module &&
              joinPath(extension.directory, ep.build_manifest.assets[AssetIdentifier.ShouldRender].module) ===
                filePath),
        )

        if (isEntryPoint) {
          throw error
        }
        // Silently skip imported files that can't be resolved
      }
    }
  },
})

function addDistPathToAssets(extP: NewExtensionPointSchemaType & {build_manifest: BuildManifest}) {
  return {
    ...extP,
    build_manifest: {
      ...extP.build_manifest,
      assets: Object.fromEntries(
        Object.entries(extP.build_manifest.assets).map(([key, value]) => [
          key as AssetIdentifier,
          {
            ...value,
            filepath: joinPath('dist', value.filepath),
          },
        ]),
      ),
    },
  }
}

async function validateUIExtensionPointConfig(
  directory: string,
  extensionPoints: NewExtensionPointSchemaType[],
  configPath: string,
): Promise<Result<unknown, string>> {
  const errors: string[] = []
  const uniqueTargets: string[] = []
  const duplicateTargets: string[] = []

  if (!extensionPoints || extensionPoints.length === 0) {
    return err(missingExtensionPointsMessage)
  }

  for await (const {module, target} of extensionPoints) {
    const fullPath = joinPath(directory, module)
    const exists = await fileExists(fullPath)

    if (!exists) {
      const notFoundPath = outputToken.path(joinPath(directory, module))

      errors.push(
        outputContent`Couldn't find ${notFoundPath}
Please check the module path for ${target}`.value,
      )
    }

    if (uniqueTargets.includes(target)) {
      duplicateTargets.push(target)
    } else {
      uniqueTargets.push(target)
    }
  }

  if (duplicateTargets.length) {
    errors.push(`Duplicate targets found: ${duplicateTargets.join(', ')}\nExtension point targets must be unique`)
  }

  if (errors.length) {
    errors.push(`Please check the configuration in ${configPath}`)
    return err(errors.join('\n\n'))
  }
  return ok({})
}

function isRemoteDomExtension(
  config: ExtensionInstance['configuration'],
): config is ExtensionInstance<{api_version: string}>['configuration'] {
  const apiVersion = config.api_version
  const [year, month] = apiVersion?.split('-').map((part: string) => parseInt(part, 10)) ?? []
  if (!year || !month) {
    return false
  }

  return year > 2025 || (year === 2025 && month >= 10)
}

export function getShouldRenderTarget(target: string) {
  return target.replace(/\.render$/, '.should-render')
}

function convertApiVersionToSemver(apiVersion: string): string {
  const [year, month] = apiVersion.split('-')
  if (!year || !month) {
    throw new AbortError('Invalid API version format. Expected format: YYYY-MM')
  }
  return `${year}.${month}.0`
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
    await init

    const content = readFileSync(filePath).toString()
    const resolvedPaths: string[] = []

    // Load TypeScript configuration once
    const {compilerOptions} = loadTsConfig(filePath)

    const [imports] = parse(content)

    const processedImports = new Set<string>()

    for (const pattern of imports) {
      const importPath = pattern.n

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

async function findAllImportedFiles(filePath: string, visited = new Set<string>()): Promise<string[]> {
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

function createTypeDefinition(
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
        // Throw specific error for the target that failed, matching the original getSharedTypeDefinition behavior
        throw new AbortError(
          `Type reference for ${target} could not be found. You might be using the wrong @shopify/ui-extensions version.`,
          `Fix the error by ensuring you have the correct version of @shopify/ui-extensions, for example ${convertApiVersionToSemver(
            apiVersion,
          )}, in your dependencies.`,
        )
      }
    }

    const relativePath = relativizePath(fullPath, dirname(typeFilePath))

    if (targets.length === 1) {
      const target = targets[0] ?? ''
      return `//@ts-ignore\ndeclare module './${relativePath}' {\n  const shopify: import('@shopify/ui-extensions/${target}').Api;\n  const globalThis: { shopify: typeof shopify };\n}\n`
    } else if (targets.length > 1) {
      const unionType = targets.map((target) => `import('@shopify/ui-extensions/${target}').Api`).join(' | ')
      return `//@ts-ignore\ndeclare module './${relativePath}' {\n  const shopify: ${unionType};\n  const globalThis: { shopify: typeof shopify };\n}\n`
    }

    return null
  } catch (error) {
    // Re-throw AbortError as-is, wrap other errors
    if (error instanceof AbortError) {
      throw error
    }
    throw new AbortError(
      `Type reference could not be found. You might be using the wrong @shopify/ui-extensions version.`,
      `Fix the error by ensuring you have the correct version of @shopify/ui-extensions, for example ${convertApiVersionToSemver(
        apiVersion,
      )}, in your dependencies.`,
    )
  }
}

async function findNearestTsConfigDir(fromFile: string, extensionDirectory: string): Promise<string | undefined> {
  const fromDirectory = dirname(fromFile)
  const tsconfigPath = await findPathUp('tsconfig.json', {cwd: fromDirectory, type: 'file', stopAt: extensionDirectory})

  if (tsconfigPath) {
    return dirname(tsconfigPath)
  }
}

export default uiExtensionSpec

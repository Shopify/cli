import {findAllImportedFiles, createTypeDefinition, findNearestTsConfigDir, parseApiVersion} from './type-generation.js'
import {Asset, AssetIdentifier, ExtensionFeature, createExtensionSpecification} from '../specification.js'
import {NewExtensionPointSchemaType, NewExtensionPointsSchema, BaseSchema, MetafieldSchema} from '../schemas.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {getExtensionPointTargetSurface} from '../../../services/dev/extension/utilities.js'
import {ExtensionInstance} from '../extension-instance.js'
import {err, ok, Result} from '@shopify/cli-kit/node/result'
import {copyFile, fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath, basename, dirname} from '@shopify/cli-kit/node/path'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {zod} from '@shopify/cli-kit/node/schema'

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
      static?: boolean
    }
  }
}

const missingExtensionPointsMessage = 'No extension targets defined, add a `targeting` field to your configuration'

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
          ...(targeting.tools
            ? {
                [AssetIdentifier.Tools]: {
                  filepath: `${config.handle}-${AssetIdentifier.Tools}-${basename(targeting.tools)}`,
                  module: targeting.tools,
                  static: true,
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
    const transformedExtensionPoints = config.extension_points?.map(addDistPathToAssets) ?? []

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

    const extensionPoints = config.extension_points || []

    const main = extensionPoints
      .map(({target, module}, index) => {
        if (shouldIncludeShopifyExtend) {
          return `import Target_${index} from '${module}';shopify.extend('${target}', (...args) => Target_${index}(...args));`
        }
        return `import '${module}';`
      })
      .join('\n')

    const assets: {[key: string]: Asset} = {}
    extensionPoints.forEach((extensionPoint) => {
      // Start of Selection
      Object.entries(extensionPoint.build_manifest.assets).forEach(([identifier, asset]) => {
        if (identifier === AssetIdentifier.Main) {
          return
        }

        // Skip static assets - they are copied after esbuild completes in rebuildContext
        if (asset.static && asset.module) {
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
  copyStaticAssets: async (config, directory, outputPath) => {
    if (!isRemoteDomExtension(config)) return

    await Promise.all(
      config.extension_points.map((extensionPoint) => {
        if (!('build_manifest' in extensionPoint)) return Promise.resolve()

        return Object.entries(extensionPoint.build_manifest.assets).map(([_, asset]) => {
          if (asset.static && asset.module) {
            const sourceFile = joinPath(directory, asset.module)
            const outputFilePath = joinPath(dirname(outputPath), asset.filepath)
            return copyFile(sourceFile, outputFilePath).catch((error) => {
              throw new Error(`Failed to copy static asset ${asset.module} to ${outputFilePath}: ${error.message}`)
            })
          }
          return Promise.resolve()
        })
      }),
    )
  },
  hasExtensionPointTarget: (config, requestedTarget) => {
    return (
      config.extension_points?.find((extensionPoint) => {
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
  if (!apiVersion) {
    return false
  }
  const {year, month} = parseApiVersion(apiVersion) ?? {year: 0, month: 0}
  return year > 2025 || (year === 2025 && month >= 10)
}

export function getShouldRenderTarget(target: string) {
  return target.replace(/\.render$/, '.should-render')
}

export default uiExtensionSpec

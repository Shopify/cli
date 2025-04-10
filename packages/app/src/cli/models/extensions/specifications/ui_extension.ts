import {Asset, AssetIdentifier, ExtensionFeature, SharedType, createExtensionSpecification} from '../specification.js'
import {NewExtensionPointSchemaType, NewExtensionPointsSchema, BaseSchema} from '../schemas.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {getExtensionPointTargetSurface} from '../../../services/dev/extension/utilities.js'
import {ExtensionInstance} from '../extension-instance.js'
import {err, ok, Result} from '@shopify/cli-kit/node/result'
import {fileExists, readFileSync, writeFileSync} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath, relativePath, relativizePath} from '@shopify/cli-kit/node/path'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {zod} from '@shopify/cli-kit/node/schema'
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
  appModuleFeatures: (config) => {
    const basic: ExtensionFeature[] = ['ui_preview', 'bundling', 'esbuild', 'generates_source_maps']
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
  contributeToSharedTypeFile: async (extension, typeFilePath) => {
    const sharedTypes: SharedType[] = []
    if (!isRemoteDomExtension(extension.configuration)) {
      return sharedTypes
    }

    const {configuration} = extension
    for await (const extensionPoint of configuration.extension_points) {
      const fullPath = joinPath(extension.directory, extensionPoint.module)
      const fileParts = fullPath.split('.')
      const fileExtension = fileParts.pop()
      const exists = await fileExists(fullPath)
      if (!fileExtension || !exists) {
        continue
      }

      const mainTypes = getSharedTypeDefinition(
        fullPath,
        typeFilePath,
        extensionPoint.target,
        configuration.api_version,
      )
      if (mainTypes) {
        sharedTypes.push(mainTypes)
      }

      if (extensionPoint.build_manifest.assets[AssetIdentifier.ShouldRender]?.module) {
        const shouldRenderTypes = getSharedTypeDefinition(
          joinPath(extension.directory, extensionPoint.build_manifest.assets[AssetIdentifier.ShouldRender].module),
          typeFilePath,
          getShouldRenderTarget(extensionPoint.target),

          configuration.api_version,
        )
        if (shouldRenderTypes) {
          sharedTypes.push(shouldRenderTypes)
        }
      }
    }

    return sharedTypes
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

  return year > 2025 || (year === 2025 && month >= 7)
}

// eslint-disable-next-line no-useless-escape
const TYPE_REF_REGEX = /^\/\/\/ <reference types="(?:[.\/]*)shopify\.d\.ts" \/>\n/

function updateTypeReference({
  fullPath,
  template,
  shouldAddTypeReference,
}: {
  fullPath: string
  template: string
  shouldAddTypeReference: boolean
}) {
  const originalContent = readFileSync(fullPath).toString()
  let fileContent = originalContent
  let match
  while ((match = TYPE_REF_REGEX.exec(fileContent))) {
    fileContent = fileContent.replace(match[0], '')
  }

  if (shouldAddTypeReference) {
    fileContent = template.concat(fileContent)
  }

  if (originalContent !== fileContent) {
    writeFileSync(fullPath, fileContent)
  }
}

export function getShouldRenderTarget(target: string) {
  return target.replace(/\.render$/, '.should-render')
}

function getSharedTypeDefinition(fullPath: string, typeFilePath: string, target: string, apiVersion: string) {
  const template = `/// <reference types="${relativePath(dirname(fullPath), typeFilePath)}" />\n`
  let types
  try {
    // We try to resolve from the module's path first with the app root as the fallback in case dependencies are hoisted to the shared workspace
    const fullTypePath = require.resolve(`@shopify/ui-extensions/${target}`, {paths: [fullPath, typeFilePath]})
    const libraryRoot = require.resolve('@shopify/ui-extensions', {paths: [fullPath, typeFilePath]})
    const importPath = `./${relativizePath(fullTypePath, dirname(typeFilePath))}`

    types = {
      libraryRoot,
      definition: `//@ts-ignore\ndeclare module './${relativizePath(fullPath, dirname(typeFilePath))}' {
  const shopify: import('${importPath}').Api;
  const globalThis: { shopify: typeof shopify };
}\n`,
    }
  } catch (_) {
    // Remove the type reference from the source file
    updateTypeReference({fullPath, template, shouldAddTypeReference: false})
    throw new Error(
      `Type reference for ${target} could not be found. You might be using the wrong @shopify/ui-extensions version. Fix the error by ensuring you install @shopify/ui-extensions@${apiVersion} in your dependencies.`,
    )
  }

  // Update the type reference
  updateTypeReference({fullPath, template, shouldAddTypeReference: true})
  return types
}

export default uiExtensionSpec

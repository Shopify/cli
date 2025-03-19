import {Asset, AssetIdentifier, ExtensionFeature, createExtensionSpecification} from '../specification.js'
import {NewExtensionPointSchemaType, NewExtensionPointsSchema, BaseSchema} from '../schemas.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {getExtensionPointTargetSurface} from '../../../services/dev/extension/utilities.js'
import {err, ok, Result} from '@shopify/cli-kit/node/result'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath, relativePath} from '@shopify/cli-kit/node/path'
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
    const main = config.extension_points
      .map(({module}) => {
        return `import '${module}'; `
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
          content: `import '${asset.module}'`,
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
    const definition: string[] = []
    for await (const {module, target} of extension.configuration.extension_points) {
      const fullPath = joinPath(extension.directory, module)
      const exists = await fileExists(fullPath)

      if (!exists || extension.configuration.api_version !== '2025-04') {
        continue
      }

      // eslint-disable-next-line no-useless-escape
      const typeRefRegex = /\/\/\/ <reference types="([.\/]*)shopify\.d\.ts" \/>/
      const template = `/// <reference types="${relativePath(fullPath, typeFilePath)}" />`

      let fileContent = readFileSync(fullPath).toString()
      let match
      if ((match = fileContent.match(typeRefRegex)) && match[1]) {
        fileContent = fileContent.replace(match[0], template)
      } else {
        fileContent = `${template}\n`.concat(fileContent)
      }
      writeFileSync(fullPath, fileContent)

      const surface = target.split('.')?.[0]
      // @todo: update to work for non-admin
      const importName = `${surface?.slice(0, 1).toUpperCase().concat(surface.slice(1))}ExtensionTargets`
      if (importName) {
        definition.push(
          `declare module './${relativePath(typeFilePath, fullPath)}' {
  const globalThis: typeof import('@shopify/ui-extensions/${target}');
  const shopify: import('@shopify/ui-extensions/${target}').Api;
}`,
        )
      }
    }
    return definition
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

export default uiExtensionSpec

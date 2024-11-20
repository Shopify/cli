import {Asset, AssetIdentifier, ExtensionFeature, createExtensionSpecification} from '../specification.js'
import {NewExtensionPointSchemaType, NewExtensionPointsSchema, BaseSchema} from '../schemas.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {getExtensionPointTargetSurface} from '../../../services/dev/extension/utilities.js'
import {err, ok, Result} from '@shopify/cli-kit/node/result'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {zod} from '@shopify/cli-kit/node/schema'

const dependency = '@shopify/checkout-ui-extensions'

const validatePoints = (config: {extension_points?: unknown[]; targeting?: unknown[]}) => {
  return config.extension_points !== undefined || config.targeting !== undefined
}

interface BuildManifest {
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
  extension_points: NewExtensionPointsSchema.optional(),
  targeting: NewExtensionPointsSchema.optional(),
})
  .refine((config) => validatePoints(config), missingExtensionPointsMessage)
  .transform((config) => {
    const extensionPoints = (config.targeting ?? config.extension_points ?? []).map((targeting) => {
      const buildManifest: BuildManifest = {
        assets: {
          [AssetIdentifier.Main]: {
            filepath: `dist/${config.handle}.js`,
            module: targeting.module,
          },
          ...(targeting.should_render?.module
            ? {
                [AssetIdentifier.ShouldRender]: {
                  filepath: `dist/${config.handle}-conditions.js`,
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
    return {
      api_version: config.api_version,
      extension_points: config.extension_points,
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
})

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

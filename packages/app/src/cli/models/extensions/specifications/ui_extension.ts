import {ExtensionFeature, createExtensionSpecification} from '../specification.js'
import {
  NewExtensionPointSchemaType,
  NewExtensionPointsSchema,
  BaseSchema,
  CapabilitiesSchema,
  MetafieldSchema,
} from '../schemas.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {configurationFileNames} from '../../../constants.js'
import {getExtensionPointTargetSurface} from '../../../services/dev/extension/utilities.js'
import {zod} from '@shopify/cli-kit/node/schema'
import {err, ok, Result} from '@shopify/cli-kit/node/result'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {getArrayRejectingUndefined} from '@shopify/cli-kit/common/array'

const dependency = '@shopify/checkout-ui-extensions'

const UIExtensionLegacySchema = BaseSchema.extend({
  settings: zod
    .object({
      fields: zod.any().optional(),
    })
    .optional(),
  extension_points: NewExtensionPointsSchema,
})

type UIExtensionLegacySchemaType = zod.infer<typeof UIExtensionLegacySchema>

const UnifiedSettingsSchema = zod
  .object({
    fields: zod
      .array(
        zod.object({
          key: zod.string().optional(),
          name: zod.string().optional(),
          description: zod.string().optional(),
          required: zod.boolean().optional(),
          type: zod.string(),
        }),
      )
      .optional(),
  })
  .optional()

const UIExtensionSchema = BaseSchema.extend({
  type: zod.literal('ui_extension'),
  name: zod.string().optional(),
  description: zod.string().optional(),
  api_version: zod.string().optional(),
  capabilities: CapabilitiesSchema.optional(),
  settings: UnifiedSettingsSchema,
  targeting: zod.array(
    zod.object({
      target: zod.string(),
      module: zod.string(),
      metafields: zod.array(MetafieldSchema).optional().default([]),
    }),
  ),
})

const UIExtensionUnifiedSchema = BaseSchema.extend({
  settings: UnifiedSettingsSchema,
  extensions: zod.array(UIExtensionSchema).min(1).max(1),
}).transform((config) => {
  const newConfig: UIExtensionLegacySchemaType = {
    name: config.extensions[0]?.name ?? config.name,
    type: config.extensions[0]?.type ?? config.type,
    description: config.extensions[0]?.description ?? config.description,
    api_version: config.extensions[0]?.api_version ?? config.api_version,
    extension_points: getArrayRejectingUndefined(config.extensions[0]?.targeting ?? []),
    capabilities: config.extensions[0]?.capabilities,
    metafields: config.extensions[0]?.metafields ?? config.metafields,
    settings: config.extensions[0]?.settings ?? config.settings,
  }
  return newConfig
})

const UnionSchema = zod.union([UIExtensionUnifiedSchema, UIExtensionLegacySchema])

const spec = createExtensionSpecification({
  identifier: 'ui_extension',
  surface: 'all',
  dependency,
  partnersWebIdentifier: 'ui_extension',
  singleEntryPath: false,
  schema: UnionSchema,
  appModuleFeatures: (config) => {
    const basic: ExtensionFeature[] = ['ui_preview', 'bundling', 'esbuild']
    const needsCart =
      config.extension_points?.find((extensionPoint) => {
        return getExtensionPointTargetSurface(extensionPoint.target) === 'checkout'
      }) !== undefined
    return needsCart ? [...basic, 'cart_url'] : basic
  },
  validate: async (config, directory) => {
    return validateUIExtensionPointConfig(directory, config.extension_points)
  },
  previewMessage(host, uuid, config, storeFqdn) {
    const links = config.extension_points.map(
      ({target}) => `${target} preview link: ${host}/extensions/${uuid}/${target}`,
    )
    return outputContent`${links.join('\n')}`
  },
  deployConfig: async (config, directory) => {
    return {
      api_version: config.api_version,
      extension_points: config.extension_points,
      capabilities: config.capabilities,
      name: config.name,
      settings: config.settings,
      localization: await loadLocalesConfig(directory, config.type),
    }
  },
  getBundleExtensionStdinContent: (config) => {
    return config.extension_points.map(({module}) => `import '${module}';`).join('\n')
  },
  shouldFetchCartUrl: (config) => {
    return (
      config.extension_points.find((extensionPoint) => {
        return getExtensionPointTargetSurface(extensionPoint.target) === 'checkout'
      }) !== undefined
    )
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
): Promise<Result<unknown, string>> {
  const errors: string[] = []
  const uniqueTargets: string[] = []
  const duplicateTargets: string[] = []

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

    if (uniqueTargets.indexOf(target) === -1) {
      uniqueTargets.push(target)
    } else {
      duplicateTargets.push(target)
    }
  }

  if (duplicateTargets.length) {
    errors.push(`Duplicate targets found: ${duplicateTargets.join(', ')}\nExtension point targets must be unique`)
  }

  if (errors.length) {
    const tomlPath = joinPath(directory, configurationFileNames.extension.ui)

    errors.push(`Please check the configuration in ${tomlPath}`)
    return err(errors.join('\n\n'))
  }
  return ok({})
}

export default spec

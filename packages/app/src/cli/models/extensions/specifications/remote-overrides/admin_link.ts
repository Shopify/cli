import {
  transformStaticAssets,
  copyStaticBuildManifestAssets,
  validateBuildManifestAssets,
  addDistPathToAssets,
} from '../build-manifest-schema.js'
import {BaseSchema, StaticExtensionPointSchemaType, StaticExtensionPointsSchema} from '../../schemas.js'
import {configWithoutFirstClassFields} from '../../specification.js'
import {loadLocalesConfig} from '../../../../utilities/extensions/locales-configuration.js'
import {zod} from '@shopify/cli-kit/node/schema'
import {JsonMapType} from '@shopify/cli-kit/node/toml'

export const AdminLinkSchema = BaseSchema.extend({
  name: zod.string(),
  type: zod.literal('admin_link'),
  targeting: StaticExtensionPointsSchema,
}).transform((config) => transformTargeting(config as {handle: string; targeting: StaticExtensionPointSchemaType[]}))

function transformTargeting(config: {handle: string; targeting: StaticExtensionPointSchemaType[]}) {
  const handle = config.handle ?? 'admin-link'
  return {
    ...config,
    targeting: config.targeting.map((targeting) => {
      return {
        ...targeting,
        ...transformStaticAssets(targeting, handle),
      }
    }),
  }
}

export type AdminLinkConfigType = zod.infer<typeof AdminLinkSchema>

export const adminLinkOverride = {
  validate: async (config: AdminLinkConfigType, _path: string, directory: string) =>
    validateBuildManifestAssets(directory, transformTargeting(config).targeting),
  copyStaticAssets: async (config: AdminLinkConfigType, directory: string, outputPath: string) =>
    copyStaticBuildManifestAssets(transformTargeting(config).targeting, directory, outputPath),
  deployConfig: async (config: JsonMapType, directory: string) => {
    const transformedTargeting = transformTargeting(config as AdminLinkConfigType).targeting.map(addDistPathToAssets)
    const parsedConfig = configWithoutFirstClassFields(config) as AdminLinkConfigType
    const localization = await loadLocalesConfig(directory, 'admin_link')

    return {
      ...parsedConfig,
      localization,
      targeting: transformedTargeting,
    }
  },
}

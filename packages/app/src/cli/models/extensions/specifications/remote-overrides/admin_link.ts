import {
  transformStaticAssets,
  copyStaticBuildManifestAssets,
  validateBuildManifestAssets,
  addDistPathToAssets,
  TargetingWithBuildManifest,
} from '../build-manifest-schema.js'
import {configWithoutFirstClassFields, CreateContractOverrideExtensionSpecType} from '../../specification.js'
import {loadLocalesConfig} from '../../../../utilities/extensions/locales-configuration.js'
import {JsonMapType} from '@shopify/cli-kit/node/toml'

interface AdminLinkPartialConfig {
  targeting: TargetingWithBuildManifest[]
  handle?: string
}

export const adminLinkOverride: CreateContractOverrideExtensionSpecType<AdminLinkPartialConfig> = {
  buildConfig: {mode: 'copy_static_assets'},
  transform: (config: AdminLinkPartialConfig) => {
    return {
      ...config,
      targeting: config.targeting.map((targeting) => {
        return {
          ...targeting,
          ...transformStaticAssets(targeting, config.handle ?? 'admin-link'),
        }
      }),
    }
  },
  validate: async (config: AdminLinkPartialConfig, _path: string, directory: string) =>
    validateBuildManifestAssets(directory, config.targeting),
  copyStaticAssets: async (config: AdminLinkPartialConfig, directory: string, outputPath: string) =>
    copyStaticBuildManifestAssets(config.targeting, directory, outputPath),
  deployConfig: async (config: AdminLinkPartialConfig, directory: string) => {
    const parsedConfig = configWithoutFirstClassFields(config as unknown as JsonMapType)
    const localization = await loadLocalesConfig(directory, 'admin_link')

    return {
      ...parsedConfig,
      localization,
      targeting: config.targeting.map(addDistPathToAssets),
    }
  },
}

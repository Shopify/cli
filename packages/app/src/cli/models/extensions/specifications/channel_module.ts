import {blocks} from '../../../constants.js'
import {ClientSteps} from '../../../services/build/client-steps.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {ApplicationModule} from '../application-module.js'
import {ModuleDescriptor} from '../module-descriptor.js'
import {BaseConfigType, BaseSchema} from '../schemas.js'
import {configWithoutFirstClassFields} from '../specification.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {zod} from '@shopify/cli-kit/node/schema'
import type {ExtensionFeature, BuildConfig, ExtensionDeployConfigOptions} from '../application-module.js'

const SUBDIRECTORY_NAME = 'specifications'
const FILE_EXTENSIONS = ['json', 'toml', 'yaml', 'yml', 'svg']

const ChannelModuleIdentifier = 'channel_config'

class ChannelModule extends ApplicationModule {
  appModuleFeatures(): ExtensionFeature[] {
    return []
  }

  override get buildConfig(): BuildConfig {
    return {
      mode: 'copy_files',
      filePatterns: FILE_EXTENSIONS.map((ext) => joinPath(SUBDIRECTORY_NAME, '**', `*.${ext}`)),
    }
  }

  override get clientSteps(): ClientSteps {
    return [
      {
        lifecycle: 'deploy',
        steps: [
          {
            id: 'copy-files',
            name: 'Copy Files',
            type: 'include_assets',
            config: {
              inclusions: [
                {
                  type: 'pattern',
                  baseDir: SUBDIRECTORY_NAME,
                  destination: SUBDIRECTORY_NAME,
                  include: FILE_EXTENSIONS.map((ext) => `**/*.${ext}`),
                },
              ],
            },
          },
        ],
      },
    ]
  }

  override async deployConfig(_options: ExtensionDeployConfigOptions): Promise<Record<string, unknown> | undefined> {
    let parsedConfig = configWithoutFirstClassFields(this.configuration)
    if (this.appModuleFeatures().includes('localization')) {
      const localization = await loadLocalesConfig(this.directory, this.identifier)
      parsedConfig = {...parsedConfig, localization}
    }
    return parsedConfig
  }
}

export const channelDescriptor: ModuleDescriptor = {
  identifier: ChannelModuleIdentifier,
  additionalIdentifiers: [],
  externalIdentifier: `${ChannelModuleIdentifier}_external`,
  externalName: 'Channel config',
  partnersWebIdentifier: ChannelModuleIdentifier,
  surface: 'test-surface',
  registrationLimit: blocks.extensions.defaultRegistrationLimit,
  experience: 'extension',
  uidStrategy: 'single',
  schema: zod.any({}) as unknown as typeof BaseSchema,
  contributeToAppConfigurationSchema: (schema) => schema,
  parseConfigurationObject: (configurationObject: object) => {
    return {state: 'ok' as const, data: configurationObject as BaseConfigType, errors: undefined}
  },
  createModule: (options) => new ChannelModule(options),
}

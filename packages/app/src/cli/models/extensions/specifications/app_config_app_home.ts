import {validateUrl} from '../../app/validation/common.js'
import {BaseSchemaWithoutHandle} from '../schemas.js'
import {TransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {copyDirectoryContents} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {zod} from '@shopify/cli-kit/node/schema'

const AppHomeSchema = BaseSchemaWithoutHandle.extend({
  application_url: validateUrl(zod.string({required_error: 'Valid URL is required'})),
  embedded: zod.boolean({required_error: 'Boolean is required', invalid_type_error: 'Value must be Boolean'}),
  app_preferences: zod
    .object({
      url: validateUrl(zod.string().max(255, {message: 'String must be less than 255 characters'})),
    })
    .optional(),
  static_root: zod.string().optional(),
})

const AppHomeTransformConfig: TransformationConfig = {
  app_url: 'application_url',
  embedded: 'embedded',
  preferences_url: 'app_preferences.url',
  static_root: 'static_root',
}

export const AppHomeSpecIdentifier = 'app_home'

const appHomeSpec = createConfigExtensionSpecification({
  identifier: AppHomeSpecIdentifier,
  buildConfig: {mode: 'static_app'} as const,
  schema: AppHomeSchema,
  transformConfig: AppHomeTransformConfig,
  patchWithAppDevURLs: (config, urls) => {
    config.application_url = urls.applicationUrl
  },
  getDevSessionUpdateMessages: async (config) => {
    return [`Using URL: ${config.application_url}`]
  },
  copyStaticAssets: async (config, directory, outputPath) => {
    console.log('&&&&&&&&&', {config})
    config.static_root = 'hosted-app/dist'
    if (!config.static_root) return
    const sourceDir = joinPath(directory, config.static_root)
    const outputDir = dirname(outputPath)

    return copyDirectoryContents(sourceDir, outputDir).catch((error) => {
      throw new Error(`Failed to copy static assets from ${sourceDir} to ${outputDir}: ${error.message}`)
    })
  },
})

export default appHomeSpec

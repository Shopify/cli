import {BaseSchemaWithoutHandle} from '../schemas.js'
import {TransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {copyDirectoryContents} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {zod} from '@shopify/cli-kit/node/schema'

const HostedAppHomeSchema = BaseSchemaWithoutHandle.extend({
  static_root: zod.string().optional(),
})

const AppHomeTransformConfig: TransformationConfig = {
  static_root: 'static_root',
}

export const AppHomeSpecIdentifier = 'hosted_app'

const hostedAppHomeSpec = createConfigExtensionSpecification({
  identifier: AppHomeSpecIdentifier,
  // Why isn't this mode setting working?
  buildConfig: {mode: 'static_app'} as const,
  schema: HostedAppHomeSchema,
  transformConfig: AppHomeTransformConfig,
  copyStaticAssets: async (config, directory, outputPath) => {
    if (!config.static_root) return
    const sourceDir = joinPath(directory, config.static_root)
    const outputDir = dirname(outputPath)

    return copyDirectoryContents(sourceDir, outputDir).catch((error) => {
      throw new Error(`Failed to copy static assets from ${sourceDir} to ${outputDir}: ${error.message}`)
    })
  },
})

export default hostedAppHomeSpec

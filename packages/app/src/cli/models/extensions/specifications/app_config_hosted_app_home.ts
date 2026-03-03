import {BaseSchemaWithoutHandle} from '../schemas.js'
import {TransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {copyDirectoryContents} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {zod} from '@shopify/cli-kit/node/schema'

const HostedAppHomeSchema = BaseSchemaWithoutHandle.extend({
  admin: zod
    .object({
      static_root: zod.string().optional(),
    })
    .optional(),
})

const HostedAppHomeTransformConfig: TransformationConfig = {
  admin: 'admin',
}

export const HostedAppHomeSpecIdentifier = 'admin'

const hostedAppHomeSpec = createConfigExtensionSpecification({
  identifier: HostedAppHomeSpecIdentifier,
  buildConfig: {mode: 'hosted_app_home'} as const,
  schema: HostedAppHomeSchema,
  transformConfig: HostedAppHomeTransformConfig,
  copyStaticAssets: async (config, directory, outputPath) => {
    const staticRoot = config.admin?.static_root
    if (!staticRoot) return
    const sourceDir = joinPath(directory, staticRoot)
    const outputDir = dirname(outputPath)

    return copyDirectoryContents(sourceDir, outputDir).catch((error) => {
      throw new Error(`Failed to copy static assets from ${sourceDir} to ${outputDir}: ${error.message}`)
    })
  },
})

export default hostedAppHomeSpec

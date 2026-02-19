import {BaseSchemaWithoutHandle} from '../schemas.js'
import {TransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const HostedAppHomeSchema = BaseSchemaWithoutHandle.extend({
  static_root: zod.string().optional(),
})

const HostedAppHomeTransformConfig: TransformationConfig = {
  static_root: 'static_root',
}

export const HostedAppHomeSpecIdentifier = 'hosted_app_home'

const hostedAppHomeSpec = createConfigExtensionSpecification({
  identifier: HostedAppHomeSpecIdentifier,
  buildConfig: {
    mode: 'copy_files',
    steps: [
      {
        id: 'copy-static-assets',
        displayName: 'Copy Static Assets',
        type: 'copy_files',
        config: {
          strategy: 'files',
          definition: {
            files: [{tomlKey: 'static_root'}],
          },
        },
      },
    ],
    stopOnError: true,
  },
  schema: HostedAppHomeSchema,
  transformConfig: HostedAppHomeTransformConfig,
})

export default hostedAppHomeSpec

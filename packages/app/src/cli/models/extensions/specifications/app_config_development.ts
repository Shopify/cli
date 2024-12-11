import {createConfigExtensionSpecification, TransformationConfig} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'
import {outputContent} from '@shopify/cli-kit/node/output'

const AppDevelopmentSchema = zod.object({
  development: zod
    .object({
      tunnel_url: zod.string().optional(),
    })
    .optional(),
})

const AppDevelopmentTransformConfig: TransformationConfig = {
  tunnel_url: 'tunnel_url',
}

export const AppDevelopmentSpecIdentifier = 'app_development'

const AppDevelopmentSpec = createConfigExtensionSpecification({
  identifier: AppDevelopmentSpecIdentifier,
  schema: AppDevelopmentSchema,
  transformConfig: AppDevelopmentTransformConfig,
  getDevSessionActionUpdateMessage: async () => {
    return outputContent`Tunnel url updated`.value
  },
})

export default AppDevelopmentSpec

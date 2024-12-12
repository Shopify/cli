import {createConfigExtensionSpecification, TransformationConfig} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const AppDevelopmentSchema = zod.object({
  development: zod
    .object({
      tunnel_url: zod.string(),
      websocket_url: zod.string(),
      dev_console_url: zod.string(),
    })
    .optional(),
})

const AppDevelopmentTransformConfig: TransformationConfig = {
  tunnel_url: 'development.tunnel_url',
  websocket_url: 'development.websocket_url',
  dev_console_url: 'development.dev_console_url',
}

export const AppDevelopmentSpecIdentifier = 'app_development'

const AppDevelopmentSpec = createConfigExtensionSpecification({
  identifier: AppDevelopmentSpecIdentifier,
  schema: AppDevelopmentSchema,
  transformConfig: AppDevelopmentTransformConfig,
})

export default AppDevelopmentSpec

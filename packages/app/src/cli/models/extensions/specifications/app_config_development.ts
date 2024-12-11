import {createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const AppDevelopmentSchema = zod.object({
  development: zod
    .object({
      tunnel_url: zod.string().optional(),
    })
    .optional(),
})

export const AppDevelopmentSpecIdentifier = 'app_development'

const AppDevelopmentSpec = createConfigExtensionSpecification({
  identifier: AppDevelopmentSpecIdentifier,
  schema: AppDevelopmentSchema,
})

export default AppDevelopmentSpec

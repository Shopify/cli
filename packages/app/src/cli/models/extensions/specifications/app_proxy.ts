import {createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const AppProxySchema = zod.object({
  app_proxy: zod
    .object({
      sub_path_prefix: zod.string(),
      sub_path: zod.string(),
      proxy_url: zod.string(),
    })
    .optional(),
})

const spec = createConfigExtensionSpecification({
  identifier: 'app_proxy',
  schema: AppProxySchema,
})

export default spec

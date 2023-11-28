import {createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const AppProxySchema = zod.object({
  app_proxy: zod
    .object({
      url: zod.string(),
      subpath: zod.string(),
      prefix: zod.string(),
    })
    .optional(),
})

const AppProxyValidateConfig = {
  url: 'url',
}

const spec = createConfigExtensionSpecification({
  identifier: 'app_proxy',
  schema: AppProxySchema,
})

export default spec

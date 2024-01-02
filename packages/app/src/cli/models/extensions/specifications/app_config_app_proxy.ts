import {validateUrl} from './configuration/schema.js'
import {ExtensionSpecification, createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

export const AppProxySchema = zod.object({
  app_proxy: zod
    .object({
      url: validateUrl(zod.string()),
      subpath: zod.string(),
      prefix: zod.string(),
    })
    .optional(),
})

export type AppProxyConfiguration = zod.infer<typeof AppProxySchema>
export const AppProxySpecIdentifier = 'app_proxy'

const spec: ExtensionSpecification = createConfigExtensionSpecification({
  identifier: AppProxySpecIdentifier,
  schema: AppProxySchema,
})

export default spec

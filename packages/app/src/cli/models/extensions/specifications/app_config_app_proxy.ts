import {validateUrl} from '../../app/validation/common.js'
import {ExtensionSpecification, createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const AppProxySchema = zod.object({
  app_proxy: zod
    .object({
      url: validateUrl(zod.string()),
      subpath: zod.string(),
      prefix: zod.string(),
    })
    .optional(),
})

export const AppProxySpecIdentifier = 'app_proxy'

const spec: ExtensionSpecification = createConfigExtensionSpecification({
  identifier: AppProxySpecIdentifier,
  schema: AppProxySchema,
})

export default spec

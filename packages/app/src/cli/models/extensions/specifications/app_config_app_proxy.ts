import {validateUrl} from '../../app/validation/common.js'
import {ExtensionSpecification, TransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const AppProxySchema = BaseSchema.extend({
  app_proxy: zod
    .object({
      url: validateUrl(zod.string({invalid_type_error: 'Value must be a valid URL'})),
      subpath: zod.string({invalid_type_error: 'Value must be a string'}),
      prefix: zod.string({invalid_type_error: 'Value must be a string'}),
    })
    .optional(),
})

export type AppProxyConfigType = zod.infer<typeof AppProxySchema>

export const AppProxySpecIdentifier = 'app_proxy'

const AppProxyTransformConfig: TransformationConfig = {
  url: 'app_proxy.url',
  subpath: 'app_proxy.subpath',
  prefix: 'app_proxy.prefix',
}

const appProxySpec: ExtensionSpecification = createConfigExtensionSpecification({
  identifier: AppProxySpecIdentifier,
  schema: AppProxySchema,
  transformConfig: AppProxyTransformConfig,
  getDevSessionUpdateMessages: async (config) => {
    if (!config.app_proxy) {
      return []
    }
    return [`Using URL: ${config.app_proxy.url}`, `Any changes to prefix and subpath will only apply to new installs`]
  },
  patchWithAppDevURLs: (config, urls) => {
    if (urls.appProxy) {
      config.app_proxy = {
        url: urls.appProxy.proxyUrl,
        subpath: urls.appProxy.proxySubPath,
        prefix: urls.appProxy.proxySubPathPrefix,
      }
    }
  },
})

export default appProxySpec

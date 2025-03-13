import {validateUrl} from '../../app/validation/common.js'
import {ExtensionSpecification, TransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

export const AppProxySpecIdentifier = 'app_proxy'

// name & type are not required for app proxy
// They are added just to conform to the BaseConfigType interface and have strongly typed functions.
// They are ignored when deploying by the `transformConfig` function.
const AppProxySchema = zod.object({
  name: zod.string().optional().default(AppProxySpecIdentifier),
  type: zod.string().optional().default(AppProxySpecIdentifier),
  app_proxy: zod
    .object({
      url: validateUrl(zod.string({invalid_type_error: 'Value must be a valid URL'})),
      subpath: zod.string({invalid_type_error: 'Value must be a string'}),
      prefix: zod.string({invalid_type_error: 'Value must be a string'}),
    })
    .optional(),
})

const AppProxyTransformConfig: TransformationConfig = {
  url: 'app_proxy.url',
  subpath: 'app_proxy.subpath',
  prefix: 'app_proxy.prefix',
}

const appProxySpec: ExtensionSpecification = createConfigExtensionSpecification({
  identifier: AppProxySpecIdentifier,
  schema: AppProxySchema,
  transformConfig: AppProxyTransformConfig,
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

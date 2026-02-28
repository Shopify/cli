import {removeTrailingSlash} from './validation/common.js'
import {validateRelativeUrl} from '../../app/validation/common.js'
import {
  ExtensionSpecification,
  createConfigExtensionSpecification,
  configWithoutFirstClassFields,
} from '../specification.js'
import {BaseSchemaWithoutHandle} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const AppProxySchema = BaseSchemaWithoutHandle.extend({
  app_proxy: zod
    .object({
      url: zod.preprocess(
        removeTrailingSlash as (arg: unknown) => unknown,
        validateRelativeUrl(zod.string({invalid_type_error: 'Value must be string'})),
      ),
      subpath: zod.string({invalid_type_error: 'Value must be a string'}),
      prefix: zod.string({invalid_type_error: 'Value must be a string'}),
    })
    .optional(),
})

export type AppProxyConfigType = zod.infer<typeof AppProxySchema>

export const AppProxySpecIdentifier = 'app_proxy'

const appProxySpec: ExtensionSpecification = createConfigExtensionSpecification({
  identifier: AppProxySpecIdentifier,
  schema: AppProxySchema,
  deployConfig: async (config) => {
    const {name, ...rest} = configWithoutFirstClassFields(config)
    return rest
  },
  transformRemoteToLocal: (content) => {
    const proxyConfig = content as {url: string; subpath: string; prefix: string}
    return {
      app_proxy: {
        url: removeTrailingSlash(proxyConfig.url),
        subpath: proxyConfig.subpath,
        prefix: proxyConfig.prefix,
      },
    }
  },
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

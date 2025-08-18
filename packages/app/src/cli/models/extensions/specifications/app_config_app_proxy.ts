import {prependApplicationUrl} from './validation/url_prepender.js'
import {removeTrailingSlash} from './validation/common.js'
import {validateRelativeUrl} from '../../app/validation/common.js'
import {
  ExtensionSpecification,
  CustomTransformationConfig,
  createConfigExtensionSpecification,
} from '../specification.js'
import {BaseSchemaWithoutHandle} from '../schemas.js'
import {CurrentAppConfiguration} from '../../app/app.js'
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

const AppProxyTransformConfig: CustomTransformationConfig = {
  forward: (content, appConfiguration) => {
    const appProxyConfig = content as {app_proxy?: {url: string; subpath: string; prefix: string}}

    if (!appProxyConfig.app_proxy) {
      return {}
    }

    let appUrl: string | undefined
    if ('application_url' in appConfiguration) {
      appUrl = (appConfiguration as CurrentAppConfiguration)?.application_url
    }
    return {
      url: prependApplicationUrl(appProxyConfig.app_proxy.url, appUrl),
      subpath: appProxyConfig.app_proxy.subpath,
      prefix: appProxyConfig.app_proxy.prefix,
    }
  },
  reverse: (content) => {
    const proxyConfig = content as {url: string; subpath: string; prefix: string}
    return {
      app_proxy: {
        url: proxyConfig.url,
        subpath: proxyConfig.subpath,
        prefix: proxyConfig.prefix,
      },
    }
  },
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

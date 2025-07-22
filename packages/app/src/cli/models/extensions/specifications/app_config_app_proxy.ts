import {validateUrl} from '../../app/validation/common.js'
import {ExtensionSpecification, TransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {EventType} from '../../../services/dev/app-events/app-event-watcher.js'
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
  patchWithAppDevURLs: (config, urls) => {
    if (urls.appProxy) {
      config.app_proxy = {
        url: urls.appProxy.proxyUrl,
        subpath: urls.appProxy.proxySubPath,
        prefix: urls.appProxy.proxySubPathPrefix,
      }
    }
  },
  getDevSessionUpdateMessage: async (config, eventType) => {
    if (eventType === EventType.Deleted) {
      return []
    }
    const messages = [`Using app proxy URL: ${config.app_proxy?.url}`]
    if (eventType === EventType.Updated) {
      messages.push(`Note: Changes to app proxy prefix and subpath won't affect existing installations.`)
    }
    return messages
  },
})

export default appProxySpec

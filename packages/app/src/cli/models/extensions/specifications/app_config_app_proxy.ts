import {validateUrl} from '../../app/validation/common.js'
import {ExtensionSpecification, TransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const AppProxySchema = BaseSchema.extend({
  app_proxy: zod
    .object({
      url: validateUrl(
        zod.string({
          error: (issue) => {
            if (issue.code === 'invalid_type') {
              return 'Value must be a valid URL'
            }
            return issue.message
          },
        }),
      ),
      subpath: zod.string({
        error: (issue) => {
          if (issue.code === 'invalid_type') {
            return 'Value must be a string'
          }
          return issue.message
        },
      }),
      prefix: zod.string({
        error: (issue) => {
          if (issue.code === 'invalid_type') {
            return 'Value must be a string'
          }
          return issue.message
        },
      }),
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
    const typedConfig = config as zod.infer<typeof AppProxySchema>
    if (urls.appProxy) {
      typedConfig.app_proxy = {
        url: urls.appProxy.proxyUrl,
        subpath: urls.appProxy.proxySubPath,
        prefix: urls.appProxy.proxySubPathPrefix,
      }
    }
  },
})

export default appProxySpec

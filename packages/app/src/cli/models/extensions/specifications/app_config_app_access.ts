import {buildAppURLForWeb} from '../../../utilities/app/app-url.js'
import {validateUrl} from '../../app/validation/common.js'
import {TransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {normalizeDelimitedString} from '@shopify/cli-kit/common/string'
import {zod} from '@shopify/cli-kit/node/schema'

const AppAccessSchema = BaseSchema.extend({
  access: zod
    .object({
      admin: zod
        .object({
          direct_api_mode: zod.union([zod.literal('online'), zod.literal('offline')]).optional(),
          embedded_app_direct_api_access: zod.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  access_scopes: zod
    .object({
      scopes: zod
        .string()
        .transform((scopes) => normalizeDelimitedString(scopes) ?? '')
        .optional(),
      required_scopes: zod.array(zod.string()).optional(),
      optional_scopes: zod.array(zod.string()).optional(),
      use_legacy_install_flow: zod.boolean().optional(),
    })
    .optional(),
  auth: zod.object({
    redirect_urls: zod.array(validateUrl(zod.string())),
  }),
})

export const AppAccessSpecIdentifier = 'app_access'

const AppAccessTransformConfig: TransformationConfig = {
  access: 'access',
  scopes: 'access_scopes.scopes',
  required_scopes: 'access_scopes.required_scopes',
  optional_scopes: 'access_scopes.optional_scopes',
  use_legacy_install_flow: 'access_scopes.use_legacy_install_flow',
  redirect_url_allowlist: 'auth.redirect_urls',
}

const allTheScopes = ['read_products', 'write_products', 'read_orders', 'write_orders', 'read_customers']

const appAccessSpec = createConfigExtensionSpecification({
  identifier: AppAccessSpecIdentifier,
  schema: AppAccessSchema,
  transformConfig: AppAccessTransformConfig,
  getDevSessionActionUpdateMessage: async (_, appConfig, storeFqdn) => {
    const scopesURL = await buildAppURLForWeb(storeFqdn, appConfig.client_id)
    return outputContent`Scopes updated. ${outputToken.link('Open app to accept scopes.', scopesURL)}`.value
  },
  patchWithAppDevURLs: (config, urls) => {
    if (urls.redirectUrlWhitelist) {
      config.auth = {redirect_urls: urls.redirectUrlWhitelist}
    }
  },
  hardcodedInputJsonSchema: JSON.stringify({
    type: 'object',
    properties: {
      access_scopes: {
        type: 'object',
        properties: {
          scopes: {type: 'string'},
          required_scopes: {type: 'array', items: {type: 'string', enum: allTheScopes}},
          optional_scopes: {type: 'array', items: {type: 'string', enum: allTheScopes}},
          use_legacy_install_flow: {type: 'boolean'},
        },
      },
      auth: {
        type: 'object',
        properties: {
          redirect_urls: {type: 'array', items: {type: 'string', format: 'uri'}},
        },
      },
    },
    required: ['access_scopes', 'auth'],
  }),
})

export default appAccessSpec

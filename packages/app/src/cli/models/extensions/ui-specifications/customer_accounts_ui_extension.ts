import {createUIExtensionSpec} from '../ui.js'
import {BaseUIExtensionSchema} from '../schemas.js'
import {schema, output} from '@shopify/cli-kit'

const dependency = {name: '@shopify/customer-account-ui-extensions-react', version: '^0.0.20'}

const CustomerAccountsSchema = BaseUIExtensionSchema.extend({
  categories: schema.define.array(schema.define.string()).optional(),
  extensionPoints: schema.define.array(schema.define.string()).optional(),
  localization: schema.define.any().optional(),
  authenticatedRedirectStartUrl: schema.define
    .string()
    .url({
      message: 'authenticated_redirect_start_url must be a valid URL.',
    })
    .optional(),
  authenticatedRedirectRedirectUrls: schema.define
    .array(
      schema.define.string().url({
        message: 'authenticated_redirect_redirect_urls does contain invalid URLs.',
      }),
    )
    .nonempty({
      message:
        'authenticated_redirect_redirect_urls can not be an empty array! It may only contain one or multiple valid URLs.',
    })
    .optional(),
})

const spec = createUIExtensionSpec({
  identifier: 'customer_accounts_ui_extension',
  externalIdentifier: 'customer_accounts_ui',
  externalName: 'Customer accounts UI',
  surface: 'customer_accounts',
  dependency,
  partnersWebIdentifier: 'customer_accounts_ui_extension',
  schema: CustomerAccountsSchema,
  deployConfig: async (config, directory) => {
    return {
      extension_points: config.extensionPoints,
      name: config.name,
      categories: config.categories,
      authenticated_redirect_start_url: config.authenticatedRedirectStartUrl,
      authenticated_redirect_redirect_urls: config.authenticatedRedirectRedirectUrls,
    }
  },
  previewMessage: (host, uuid, _, storeFqdn) => {
    const [storeName, ...storeDomainParts] = storeFqdn.split('.')
    const accountsUrl = `${storeName}.account.${storeDomainParts.join('.')}`
    const origin = encodeURIComponent(`${host}/extensions`)
    const publicURL = `https://${accountsUrl}/extensions-development?origin=${origin}&extensionId=${uuid}`
    const notice = `Please open ${host} and click on 'Visit Site' and then close the tab to allow connections.\n`
    return output.content`${notice}Preview link: ${publicURL}`
  },
})

export default spec

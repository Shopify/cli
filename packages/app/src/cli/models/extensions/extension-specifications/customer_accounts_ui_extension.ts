import {createExtensionSpec} from '../extensions.js'
import {BaseExtensionSchema} from '../schemas.js'
import {isValidUrl} from '../../../utilities/extensions/url.js'
import {schema, output, error} from '@shopify/cli-kit'

const dependency = {name: '@shopify/customer-account-ui-extensions-react', version: '^0.0.20'}

const CustomerAccountsSchema = BaseExtensionSchema.extend({
  categories: schema.define.array(schema.define.string()).optional(),
  extensionPoints: schema.define.array(schema.define.string()).optional(),
  localization: schema.define.any().optional(),
  authenticatedRedirectStartUrl: schema.define.string().optional(),
  authenticatedRedirectRedirectUrls: schema.define.array(schema.define.string()).optional(),
})

const spec = createExtensionSpec({
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
  preDeployValidation: (config) => {
    if (config.authenticatedRedirectStartUrl !== undefined && !isValidUrl(config.authenticatedRedirectStartUrl)) {
      throw new error.Abort(
        `The property "authenticated_redirect_start_url" does not contain a valid URL.`,
        `Please update your shopify.ui.extension.toml to include a valid "authenticated_redirect_start_url"`,
      )
    }

    if (config.authenticatedRedirectRedirectUrls !== undefined) {
      const invalidUrls = config.authenticatedRedirectRedirectUrls.filter((url) => !isValidUrl(url))

      if (config.authenticatedRedirectRedirectUrls.length === 0) {
        throw new error.Abort(
          `The property "authenticated_redirect_redirect_urls" can not be an empty array! It may only contain one or multiple valid URLs`,
          `Please update your shopify.ui.extension.toml to include a valid "authenticated_redirect_redirect_urls"`,
        )
      }

      if (invalidUrls.length) {
        throw new error.Abort(
          `The property "authenticated_redirect_redirect_urls" does contain invalid URLs. More specifically, the following values are invalid: "${invalidUrls.join(
            ', ',
          )}".`,
          `Please update your shopify.ui.extension.toml to include a valid "authenticated_redirect_redirect_urls"`,
        )
      }
    }

    return Promise.resolve()
  },
})

export default spec

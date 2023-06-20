import {createExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {zod} from '@shopify/cli-kit/node/schema'
import {outputContent} from '@shopify/cli-kit/node/output'

const dependency = '@shopify/customer-account-ui-extensions'

const CustomerAccountsSchema = BaseSchema.extend({
  categories: zod.array(zod.string()).optional(),
  extension_points: zod.array(zod.string()).optional(),
  localization: zod.any().optional(),
  authenticated_redirect_start_url: zod
    .string()
    .url({
      message: 'authenticated_redirect_start_url must be a valid URL.',
    })
    .optional(),
  authenticated_redirect_redirect_urls: zod
    .array(
      zod.string().url({
        message: 'authenticated_redirect_redirect_urls does contain invalid URLs.',
      }),
    )
    .nonempty({
      message:
        'authenticated_redirect_redirect_urls can not be an empty array! It may only contain one or multiple valid URLs.',
    })
    .optional(),
})

const spec = createExtensionSpecification({
  identifier: 'customer_accounts_ui_extension',
  surface: 'customer_accounts',
  dependency,
  partnersWebIdentifier: 'customer_accounts_ui_extension',
  schema: CustomerAccountsSchema,
  appModuleFeatures: (_) => ['ui_preview', 'bundling', 'esbuild'],
  deployConfig: async (config, directory) => {
    return {
      extension_points: config.extension_points,
      name: config.name,
      categories: config.categories,
      localization: await loadLocalesConfig(directory, 'customer_accounts_ui'),
      authenticated_redirect_start_url: config.authenticated_redirect_start_url,
      authenticated_redirect_redirect_urls: config.authenticated_redirect_redirect_urls,
    }
  },
  previewMessage: (host, uuid, _, storeFqdn) => {
    const [storeName, ...storeDomainParts] = storeFqdn.split('.')
    const accountsUrl = `${storeName}.account.${storeDomainParts.join('.')}`
    const origin = encodeURIComponent(`${host}/extensions`)
    const publicURL = `https://${accountsUrl}/extensions-development?origin=${origin}&extensionId=${uuid}`
    const notice = `Please open ${host} and click on 'Visit Site' and then close the tab to allow connections.\n`
    return outputContent`${notice}Preview link: ${publicURL}`
  },
})

export default spec

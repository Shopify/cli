import {createExtensionSpec} from '../extensions.js'
import {BaseExtensionSchema} from '../schemas.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {schema, output} from '@shopify/cli-kit'

const dependency = {name: '@shopify/customer-account-ui-extensions-react', version: '^0.0.20'}

const CustomerAccountsSchema = BaseExtensionSchema.extend({
  categories: schema.define.array(schema.define.string()).optional(),
  localization: schema.define.any().optional(),
})

const spec = createExtensionSpec({
  identifier: 'customer_accounts_ui_extension',
  externalIdentifier: 'customer_accounts_ui',
  surface: 'customer_accounts',
  dependency,
  partnersWebId: 'customer_accounts_ui_extension',
  schema: CustomerAccountsSchema,
  deployConfig: async (config, directory) => {
    return {
      extension_points: config.extensionPoints,
      name: config.name,
      categories: config.categories,
      localization: await loadLocalesConfig(directory),
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

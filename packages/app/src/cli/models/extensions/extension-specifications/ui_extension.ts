import {createExtensionSpec} from '../extensions.js'
import {BaseExtensionSchema} from '../schemas.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {schema} from '@shopify/cli-kit'

const dependency = {name: '@shopify/checkout-ui-extensions-react', version: '^0.20.0'}

const UIExtensionSchema = BaseExtensionSchema.extend({
  settings: schema.define.string().optional(),
})

const spec = createExtensionSpec({
  identifier: 'ui_extension',
  externalIdentifier: 'ui_extension',
  externalName: 'UI Extension',
  surface: 'checkout',
  dependency,
  partnersWebIdentifier: 'checkout_ui_extension',
  singleEntryPath: false,
  schema: UIExtensionSchema,
  deployConfig: async (config, directory) => {
    return {
      extension_points: config.extensionPoints,
      capabilities: config.capabilities,
      metafields: config.metafields,
      name: config.name,
      settings: config.settings,
      localization: await loadLocalesConfig(directory, 'checkout_ui'),
    }
  },
})

export default spec

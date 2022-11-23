import {createExtensionSpec} from '../extensions.js'
import {BaseExtensionSchema} from '../schemas.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {schema} from '@shopify/cli-kit'

const dependency = {name: '@shopify/checkout-ui-extensions-react', version: '^0.20.0'}

const CheckoutSchema = BaseExtensionSchema.extend({
  extensionPoints: schema.define.array(schema.define.string()).optional(),
  // https://shopify.dev/api/checkout-extensions/checkout/configuration#settings-definition
  settings: schema.define
    .object({
      fields: schema.define.array(
        schema.define.object({
          key: schema.define.string(),
          type: schema.define.union([
            schema.define.literal('boolean'),
            schema.define.literal('date'),
            schema.define.literal('date_time'),
            schema.define.literal('single_line_text_field'),
            schema.define.literal('multi_line_text_field'),
            schema.define.literal('number_integer'),
            schema.define.literal('number_decimal'),
            schema.define.literal('variant_reference'),
          ]),
          name: schema.define.string(),
          description: schema.define.string().optional(),
          validations: schema.define
            .array(
              schema.define.object({
                name: schema.define.string(),
                value: schema.define.union([
                  schema.define.literal('min'),
                  schema.define.literal('max'),
                  schema.define.literal('regex'),
                  schema.define.literal('choices'),
                  schema.define.literal('max_precision'),
                ]),
              }),
            )
            .optional(),
        }),
      ),
    })
    .optional(),
})

const spec = createExtensionSpec({
  identifier: 'checkout_ui_extension',
  externalIdentifier: 'checkout_ui',
  externalName: 'Checkout UI',
  surface: 'checkout',
  dependency,
  partnersWebIdentifier: 'checkout_ui_extension',
  schema: CheckoutSchema,
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

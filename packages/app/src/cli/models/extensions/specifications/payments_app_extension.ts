import {createExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const PaymentsAppExtensionSchema = BaseSchema.extend({
  // Extension inputs as defined here:
  // https://shopify.dev/docs/apps/payments/create-a-payments-app
  type: zod.literal('payments_extension'),
  payment_session_url: zod.string().url(),
  refund_session_url: zod.string().url(),
  capture_session_url: zod.string().url(),
  void_session_url: zod.string().url(),
  confirmation_callback_url: zod.string().url().optional(),
  merchant_label: zod.string(),
  supported_countries: zod.array(zod.string()),
  supported_payment_methods: zod.array(zod.string()),
  test_mode_available: zod.boolean(),
  subtype: zod.string(),
  input: zod
    .object({
      metafield_identifiers: zod
        .object({
          namespace: zod.string(),
          key: zod.string(),
        })
        .optional(),
    })
    .optional(),
})

const spec = createExtensionSpecification({
  identifier: 'payments_extension',
  schema: PaymentsAppExtensionSchema,
  appModuleFeatures: (_) => ['bundling'],
  deployConfig: async (config, _) => {
    return {
      start_payment_session_url: config.payment_session_url,
      start_refund_session_url: config.refund_session_url,
      start_capture_session_url: config.capture_session_url,
      start_void_session_url: config.void_session_url,
      confirmation_callback_url: config.confirmation_callback_url,
      merchant_label: config.merchant_label,
      supported_countries: config.supported_countries,
      supported_payment_methods: config.supported_payment_methods,
      test_mode_available: config.test_mode_available,
      subtype: config.subtype,
    }
  },
})

export default spec

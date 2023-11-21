import {createExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const PaymentsExtensionSchema = BaseSchema.extend({
  // production_api_base_url: zod.string(),
  // benchmark_api_base_url: zod.string().optional(),
  // Extension inputs as defined here:
  // https://shopify.dev/docs/apps/payments/create-a-payments-app#credit-card-payments-app-extension
  payment_session_url: zod.string().url(),
  refund_session_url: zod.string().url(),
  capture_session_url: zod.string().url(),
  void_session_url: zod.string().url(),
  confirm_session_url: zod.string().url().optional(),
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

const PaymentsExtensionSpecfication = createExtensionSpecification({
  identifier: 'payments_extension',
  schema: PaymentsExtensionSchema,
  appModuleFeatures: (_) => ['bundling'],
  deployConfig: async (config, _) => {
    return {
      // production_api_base_url: config.production_api_base_url,
      // benchmark_api_base_url: config.benchmark_api_base_url,
      start_payment_session_url: config.payment_session_url,
      refund_session_url: config.refund_session_url,
      capture_session_url: config.capture_session_url,
      void_session_url: config.void_session_url,
      confirm_session_url: config.confirm_session_url,
      metafields: config.metafields,
      api_version: config.api_version,
      metafield_identifiers: config.input?.metafield_identifiers,
    }
  },
})

export default PaymentsExtensionSpecfication // cliPaymentsAppSpecfication

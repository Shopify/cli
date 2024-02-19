import {BaseSchema} from '../../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const MAX_LABEL_SIZE = 50

export const BasePaymentsAppExtensionSchema = BaseSchema.extend({
  api_version: zod.string(),
  payment_session_url: zod.string().url(),
  refund_session_url: zod.string().url().optional(),
  capture_session_url: zod.string().url().optional(),
  void_session_url: zod.string().url().optional(),

  supported_countries: zod.array(zod.string()),
  supported_payment_methods: zod.array(zod.string()),

  test_mode_available: zod.boolean(),

  merchant_label: zod.string().max(MAX_LABEL_SIZE),

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

export const BuyerLabelSchema = zod.object({
  buyer_label: zod.string().max(MAX_LABEL_SIZE).optional(),
  buyer_label_translations: zod.array(zod.object({locale: zod.string(), label: zod.string()})).optional(),
})

export const DeferredPaymentsSchema = zod.object({
  supports_installments: zod.boolean(),
  supports_deferred_payments: zod.boolean(),
})

export const ConfirmationSchema = zod.object({
  confirmation_callback_url: zod.string().url().optional(),
  supports_3ds: zod.boolean(),
})

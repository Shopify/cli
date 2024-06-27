import {BaseSchema} from '../../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const MAX_LABEL_SIZE = 50

export interface BasePaymentsAppExtensionDeployConfigType {
  api_version: string
  start_payment_session_url: string
  start_refund_session_url?: string
  start_capture_session_url?: string
  start_void_session_url?: string
  merchant_label: string
  supported_countries: string[]
  supported_payment_methods: string[]
  supported_buyer_contexts?: {currency: string; countries?: [string, ...string[]]}[]
  test_mode_available: boolean
  supports_oversell_protection?: boolean
}

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

export const MultipleCaptureSchema = zod.object({
  multiple_capture: zod.boolean().optional(),
})

export const ConfirmationSchema = zod.object({
  confirmation_callback_url: zod.string().url().optional(),
  supports_3ds: zod.boolean(),
})

export const SupportedBuyerContextsSchema = zod.object({
  supported_buyer_contexts: zod
    .array(
      zod
        .object({
          currency: zod.string(),
          countries: zod.array(zod.string()).nonempty().optional(),
        })
        .strict(),
    )
    .optional()
    .refine(
      (values) => {
        return (
          values === undefined || values.every((value) => value.countries) || values.every((value) => !value.countries)
        )
      },
      {
        message:
          'Must all be defined with only a currency, or must all be defined with a currency plus countries -- a mixture of the two is not allowed',
      },
    ),
})

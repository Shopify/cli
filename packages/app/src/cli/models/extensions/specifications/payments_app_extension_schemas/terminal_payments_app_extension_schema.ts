import {BasePaymentsAppExtensionSchema} from './base_payments_app_extension_schema.js'
import {zod} from '@shopify/cli-kit/node/schema'

export type TerminalPaymentsAppExtensionConfigType = zod.infer<typeof TerminalPaymentsAppExtensionSchema>

export const TERMINAL_TARGET = 'payments.terminal.render'

export const TerminalPaymentsAppExtensionSchema = BasePaymentsAppExtensionSchema.extend({
  targeting: zod.array(zod.object({target: zod.literal(TERMINAL_TARGET)})).length(1),
})

export async function terminalPaymentsAppExtensionDeployConfig(
  config: TerminalPaymentsAppExtensionConfigType,
): Promise<{[key: string]: unknown} | undefined> {
  return {
    api_version: config.api_version,
    start_payment_session_url: config.payment_session_url,
    start_refund_session_url: config.refund_session_url,
    start_capture_session_url: config.capture_session_url,
    start_void_session_url: config.void_session_url,
    merchant_label: config.merchant_label,
    supported_countries: config.supported_countries,
    supported_payment_methods: config.supported_payment_methods,
    test_mode_available: config.test_mode_available,
  }
}

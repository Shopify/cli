import {
  BasePaymentsAppExtensionSchema,
  BasePaymentsAppExtensionDeployConfigType,
  BuyerLabelSchema,
  ConfirmationSchema,
  DeferredPaymentsSchema,
  MultipleCaptureSchema,
  SupportedBuyerContextsSchema,
} from './base_payments_app_extension_schema.js'
import {isHttpsUrl} from '../../../app/validation/common.js'
import {zod} from '@shopify/cli-kit/node/schema'

export type AcceleratedWalletPaymentsAppExtensionConfigType = zod.infer<
  typeof AcceleratedWalletPaymentsAppExtensionSchema
>

export const ACCELERATED_WALLET_TARGET = 'payments.accelerated-wallet.render'

const HexColorSchema = zod.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a 6-digit hex color, like #1A2B3C')

const BUTTON_LOGO_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico']

// Checks the shape only, not that the file exists. Backslashes count as separators too, so a Windows-style path
// can't start at a root or step out of the extension folder either.
function isButtonLogoPath(path: string): boolean {
  const hasScheme = path.split('/')[0]!.includes(':')
  const segments = path.split(/[/\\]/)
  const startsAtRoot = segments[0] === ''
  const fileName = segments[segments.length - 1]!
  const hasImageExtension = BUTTON_LOGO_EXTENSIONS.some(
    (extension) => fileName.endsWith(extension) && fileName.length > extension.length,
  )
  return !hasScheme && !startsAtRoot && !segments.includes('..') && hasImageExtension
}

const ButtonLogoPathSchema = zod
  .string()
  .refine(
    isButtonLogoPath,
    `Must be a relative path inside the extension folder to a ${BUTTON_LOGO_EXTENSIONS.join(', ')} file, like assets/logo.png`,
  )

const HOST_NAME_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/

// A domain name of two or more labels that isn't an IP address or a localhost name. The URL parser writes an IPv4
// address in dotted decimal, so a last label of only digits means one, and an IPv6 address keeps its brackets, which
// fail the label check. The rule is strict on purpose: loosening it later won't break any extension, but tightening it
// would.
function isDomainName(hostname: string): boolean {
  const labels = hostname.split('.')
  const topLevelLabel = labels[labels.length - 1]!
  return (
    hostname.length <= 253 &&
    labels.length >= 2 &&
    labels.every((label) => HOST_NAME_LABEL.test(label)) &&
    !/^\d+$/.test(topLevelLabel) &&
    topLevelLabel !== 'localhost'
  )
}

// An entry must already be the origin the URL parser derives from it, so it can be compared with a sheet URL's origin
// as it is. Anything the parser leaves out or rewrites fails: a path or a lone trailing slash, a query, a fragment,
// user info, whitespace, the default port and upper-case letters. The port is checked for shape only: an entry on a
// port that browsers block can't open a sheet anyway.
function isSheetOrigin(origin: string): boolean {
  if (!isHttpsUrl(origin)) return false
  const url = new URL(origin)
  return url.origin === origin && isDomainName(url.hostname)
}

const SheetOriginsSchema = zod
  .array(
    zod
      .string()
      .refine(
        isSheetOrigin,
        'Must be an HTTPS origin in lower case, with a domain name (not an IP address, localhost or wildcard), an optional port (leave out :443) and no path or trailing slash, like https://example.com or https://example.com:8443',
      ),
  )
  .nonempty({message: 'Must list at least one origin'})
  .superRefine((origins, context) => {
    origins.forEach((origin, index) => {
      // An entry that isn't an origin already has its own error.
      if (isSheetOrigin(origin) && origins.indexOf(origin) < index) {
        context.addIssue({
          code: zod.ZodIssueCode.custom,
          message: 'Must not repeat an origin listed earlier',
          path: [index],
        })
      }
    })
  })

export const AcceleratedWalletPaymentsAppExtensionSchema = BasePaymentsAppExtensionSchema.merge(BuyerLabelSchema)
  .merge(DeferredPaymentsSchema)
  .merge(ConfirmationSchema)
  .merge(MultipleCaptureSchema)
  .merge(SupportedBuyerContextsSchema)
  .extend({
    targeting: zod.array(zod.object({target: zod.literal(ACCELERATED_WALLET_TARGET)})).length(1),
    // The wallet button shows only a logo, so this label is its accessible name and can't be left out or empty.
    buyer_label: BuyerLabelSchema.shape.buyer_label.unwrap().min(1),
    supports_oversell_protection: zod.boolean().optional(),
    supports_3ds: zod.boolean().optional(),
    wallet_session_create_url: zod.string().url(),
    wallet_session_verify_url: zod.string().url(),
    // The platform opens the extension's sheet only on one of these origins, so the sheet can't be sent to another
    // host. The key is required from the start because making a key required after the target ships would break every
    // extension that already uses the target.
    sheet_origins: SheetOriginsSchema,
    button_logo_path: ButtonLogoPathSchema,
    button_logo_path_dark: ButtonLogoPathSchema,
    button_background_color: HexColorSchema,
    button_background_color_dark: HexColorSchema,
    button_foreground_color: HexColorSchema,
    button_foreground_color_dark: HexColorSchema,
  })
  .refine((schema) => !schema.supports_oversell_protection || schema.confirmation_callback_url, {
    message: 'Property required when supports_oversell_protection is true',
    path: ['confirmation_callback_url'],
  })
  .refine((schema) => schema.supports_installments === schema.supports_deferred_payments, {
    message: 'supports_installments and supports_deferred_payments must be the same',
  })

export interface AcceleratedWalletPaymentsAppExtensionDeployConfigType extends BasePaymentsAppExtensionDeployConfigType {
  // MultipleCaptureSchema
  multiple_capture?: boolean

  // BuyerLabelSchema
  default_buyer_label: string
  buyer_label_to_locale?: {locale: string; label: string}[]

  // DeferredPaymentsSchema
  supports_deferred_payments: boolean
  supports_installments: boolean

  // ConfirmationSchema
  confirmation_callback_url?: string
  supports_3ds: boolean

  // AcceleratedWallet-specific fields
  wallet_session_create_url: string
  wallet_session_verify_url: string
  sheet_origins: [string, ...string[]]
  button_logo_path: string
  button_logo_path_dark: string
  button_background_color: string
  button_background_color_dark: string
  button_foreground_color: string
  button_foreground_color_dark: string
}

export function acceleratedWalletDeployConfigToCLIConfig(
  config: AcceleratedWalletPaymentsAppExtensionDeployConfigType,
): Omit<AcceleratedWalletPaymentsAppExtensionConfigType, 'name' | 'type' | 'metafields' | 'targeting'> | undefined {
  return {
    api_version: config.api_version,
    payment_session_url: config.start_payment_session_url,
    refund_session_url: config.start_refund_session_url,
    capture_session_url: config.start_capture_session_url,
    void_session_url: config.start_void_session_url,
    confirmation_callback_url: config.confirmation_callback_url,
    multiple_capture: config.multiple_capture,
    merchant_label: config.merchant_label,
    supported_countries: config.supported_countries,
    supported_payment_methods: config.supported_payment_methods,
    supported_buyer_contexts: config.supported_buyer_contexts,
    test_mode_available: config.test_mode_available,
    buyer_label: config.default_buyer_label,
    buyer_label_translations: config.buyer_label_to_locale,
    supports_oversell_protection: config.supports_oversell_protection,
    supports_3ds: config.supports_3ds,
    supports_deferred_payments: config.supports_deferred_payments,
    supports_installments: config.supports_installments,
    wallet_session_create_url: config.wallet_session_create_url,
    wallet_session_verify_url: config.wallet_session_verify_url,
    sheet_origins: config.sheet_origins,
    button_logo_path: config.button_logo_path,
    button_logo_path_dark: config.button_logo_path_dark,
    button_background_color: config.button_background_color,
    button_background_color_dark: config.button_background_color_dark,
    button_foreground_color: config.button_foreground_color,
    button_foreground_color_dark: config.button_foreground_color_dark,
  }
}

export async function acceleratedWalletPaymentsAppExtensionDeployConfig(
  config: AcceleratedWalletPaymentsAppExtensionConfigType,
): Promise<{[key: string]: unknown} | undefined> {
  return {
    api_version: config.api_version,
    start_payment_session_url: config.payment_session_url,
    start_refund_session_url: config.refund_session_url,
    start_capture_session_url: config.capture_session_url,
    start_void_session_url: config.void_session_url,
    confirmation_callback_url: config.confirmation_callback_url,
    multiple_capture: config.multiple_capture,
    merchant_label: config.merchant_label,
    supported_countries: config.supported_countries,
    supported_payment_methods: config.supported_payment_methods,
    supported_buyer_contexts: config.supported_buyer_contexts,
    test_mode_available: config.test_mode_available,
    default_buyer_label: config.buyer_label,
    buyer_label_to_locale: config.buyer_label_translations,
    supports_oversell_protection: config.supports_oversell_protection,
    supports_3ds: config.supports_3ds,
    supports_deferred_payments: config.supports_deferred_payments,
    supports_installments: config.supports_installments,
    wallet_session_create_url: config.wallet_session_create_url,
    wallet_session_verify_url: config.wallet_session_verify_url,
    sheet_origins: config.sheet_origins,
    button_logo_path: config.button_logo_path,
    button_logo_path_dark: config.button_logo_path_dark,
    button_background_color: config.button_background_color,
    button_background_color_dark: config.button_background_color_dark,
    button_foreground_color: config.button_foreground_color,
    button_foreground_color_dark: config.button_foreground_color_dark,
  }
}

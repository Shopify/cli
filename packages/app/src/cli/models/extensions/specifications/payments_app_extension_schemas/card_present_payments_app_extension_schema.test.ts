import {
  CardPresentPaymentsAppExtensionConfigType,
  CardPresentPaymentsAppExtensionSchema,
  cardPresentPaymentsAppExtensionDeployConfig,
  CARD_PRESENT_TARGET,
} from './card_present_payments_app_extension_schema.js'
import {describe, expect, test} from 'vitest'
import {zod} from '@shopify/cli-kit/node/schema'

const config: CardPresentPaymentsAppExtensionConfigType = {
  name: 'test extension',
  type: 'payments_extension',
  payment_session_url: 'http://foo.bar',
  refund_session_url: 'http://foo.bar',
  capture_session_url: 'http://foo.bar',
  void_session_url: 'http://foo.bar',
  sync_terminal_transaction_result_url: 'http://foo.bar',
  merchant_label: 'some-label',
  supported_countries: ['CA'],
  supported_payment_methods: ['PAYMENT_METHOD'],
  test_mode_available: true,
  targeting: [{target: 'payments.card-present.render'}],
  api_version: '2022-07',
  description: 'my payments app extension',
}

describe('CardPresentPaymentsAppExtensionSchema', () => {
  test('validates a configuration with valid fields', async () => {
    const {success} = CardPresentPaymentsAppExtensionSchema.safeParse(config)

    expect(success).toBe(true)
  })

  test('returns an error if no target is provided', async () => {
    expect(() =>
      CardPresentPaymentsAppExtensionSchema.parse({
        ...config,
        targeting: [{...config.targeting[0]!, target: null}],
      }),
    ).toThrowError(
      new zod.ZodError([
        {
          received: null,
          code: zod.ZodIssueCode.invalid_literal,
          expected: CARD_PRESENT_TARGET,
          path: ['targeting', 0, 'target'],
          message: `Invalid literal value, expected "${CARD_PRESENT_TARGET}"`,
        },
      ]),
    )
  })

  test('returns an error if payment_session_url is not provided', async () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const {payment_session_url, ...rest} = config
    expect(() =>
      CardPresentPaymentsAppExtensionSchema.parse({
        ...rest,
      }),
    ).toThrowError(
      new zod.ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['payment_session_url'],
          message: 'Required',
        },
      ]),
    )
  })

  test('returns an error if refund_session_url is not provided', async () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const {refund_session_url, ...rest} = config
    expect(() =>
      CardPresentPaymentsAppExtensionSchema.parse({
        ...rest,
      }),
    ).toThrowError(
      new zod.ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['refund_session_url'],
          message: 'Required',
        },
      ]),
    )
  })

  test('returns an error if capture_session_url is not provided', async () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const {capture_session_url, ...rest} = config
    expect(() =>
      CardPresentPaymentsAppExtensionSchema.parse({
        ...rest,
      }),
    ).toThrowError(
      new zod.ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['capture_session_url'],
          message: 'Required',
        },
      ]),
    )
  })

  test('returns an error if void_session_url is not provided', async () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const {void_session_url, ...rest} = config
    expect(() =>
      CardPresentPaymentsAppExtensionSchema.parse({
        ...rest,
      }),
    ).toThrowError(
      new zod.ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['void_session_url'],
          message: 'Required',
        },
      ]),
    )
  })

  test('validates with optional sync_terminal_transaction_result_url', async () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const {sync_terminal_transaction_result_url, ...rest} = config
    const {success} = CardPresentPaymentsAppExtensionSchema.safeParse({
      ...rest,
    })

    expect(success).toBe(true)
  })

  test('returns an error if sync_terminal_transaction_result_url is not a valid URL', async () => {
    expect(() =>
      CardPresentPaymentsAppExtensionSchema.parse({
        ...config,
        sync_terminal_transaction_result_url: 'not-a-url',
      }),
    ).toThrowError(
      new zod.ZodError([
        {
          validation: 'url',
          code: 'invalid_string',
          message: 'Invalid url',
          path: ['sync_terminal_transaction_result_url'],
        },
      ]),
    )
  })
})

describe('cardPresentPaymentsAppExtensionDeployConfig', () => {
  test('maps deploy configuration from extension configuration', async () => {
    const result = await cardPresentPaymentsAppExtensionDeployConfig(config)

    expect(result).toMatchObject({
      api_version: config.api_version,
      start_payment_session_url: config.payment_session_url,
      start_refund_session_url: config.refund_session_url,
      start_capture_session_url: config.capture_session_url,
      start_void_session_url: config.void_session_url,
      merchant_label: config.merchant_label,
      supported_countries: config.supported_countries,
      supported_payment_methods: config.supported_payment_methods,
      sync_terminal_transaction_result_url: config.sync_terminal_transaction_result_url,
      test_mode_available: config.test_mode_available,
    })
  })
})

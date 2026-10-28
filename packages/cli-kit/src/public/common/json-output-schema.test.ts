import {
  formatJsonOutputTimestamp,
  jsonOutputTimestampSchema,
  jsonOutputStoreDomainSchema,
} from './json-output-schema.js'
import {expect, test} from 'vitest'

test.each(['shop.myshopify.com', 'my-shop.myshopify.com', 'shop123.myshopify.com'])(
  'accepts canonical store domain %s',
  (storeDomain) => {
    expect(jsonOutputStoreDomainSchema.parse(storeDomain)).toBe(storeDomain)
  },
)

test.each([
  '',
  null,
  'Shop.myshopify.com',
  'shop_name.myshopify.com',
  '-shop.myshopify.com',
  'shop.myshopify.io',
  'shop.my.shop.dev',
  'nested.shop.myshopify.com',
  'https://shop.myshopify.com',
])('rejects noncanonical store domain %s', (storeDomain) => {
  expect(jsonOutputStoreDomainSchema.safeParse(storeDomain).success).toBe(false)
})

test.each([
  ['2026-09-30T12:34:56Z', '2026-09-30T12:34:56Z'],
  ['2026-09-30T12:34:56.999Z', '2026-09-30T12:34:56Z'],
  ['2026-09-30T14:34:56.789+02:00', '2026-09-30T12:34:56Z'],
])('formats %s as a canonical JSON timestamp', (input, expected) => {
  const timestamp = formatJsonOutputTimestamp(new Date(input))

  expect(timestamp).toBe(expected)
  expect(jsonOutputTimestampSchema.parse(timestamp)).toBe(timestamp)
})

import {locateTomlValues, tomlKey} from './toml-locations.js'
import {decodeToml} from '@shopify/cli-kit/node/toml/codec'
import {describe, expect, test} from 'vitest'

describe('tomlKey', () => {
  test('joins bare keys with dots, quotes other keys, and puts indexes in brackets', () => {
    expect(tomlKey(['webhooks', 'subscriptions', 1, 'uri'])).toBe('webhooks.subscriptions[1].uri')
    expect(tomlKey(['auth', 'redirect_urls', 0])).toBe('auth.redirect_urls[0]')
    expect(tomlKey(['site', 'google.com', 'a b'])).toBe('site."google.com"."a b"')
  })
})

describe('locateTomlValues', () => {
  test('keys values in tables, arrays of tables, and arrays by index', () => {
    const lines = locateTomlValues(`name = "App"

[auth]
redirect_urls = ["https://a.example/callback", "https://b.example/callback"]

[webhooks]
api_version = "2026-07"

  [[webhooks.subscriptions]]
  topics = ["orders/create"]
  uri = "https://a.example/orders"

  [[webhooks.subscriptions]]
  uri = "https://a.example/products"

  [webhooks.subscriptions.filter]
  value = 1

[webhooks.privacy_compliance]
shop_deletion_url = "https://a.example/shop/redact"
`)

    expect(Object.fromEntries(lines)).toEqual({
      name: 1,
      'auth.redirect_urls[0]': 4,
      'auth.redirect_urls[1]': 4,
      'webhooks.api_version': 7,
      'webhooks.subscriptions[0].topics[0]': 10,
      'webhooks.subscriptions[0].uri': 11,
      'webhooks.subscriptions[1].uri': 14,
      'webhooks.subscriptions[1].filter.value': 17,
      'webhooks.privacy_compliance.shop_deletion_url': 20,
    })
  })

  test('reads inline tables, dotted and quoted keys, and multi-line arrays with comments', () => {
    const lines = locateTomlValues(`webhooks.api_version = "2026-07"
"auth" . 'redirect_urls' = [ # first
  "https://a.example/callback", # comment with "quotes" and = signs
  # [[not.a.table]]

  'https://b.example/callback',
]
[webhooks]
subscriptions = [{topics = ["a", "b"], uri = "https://a.example/a"}, { uri = "https://a.example/b" }]
`)

    expect(Object.fromEntries(lines)).toEqual({
      'webhooks.api_version': 1,
      'auth.redirect_urls[0]': 3,
      'auth.redirect_urls[1]': 6,
      'webhooks.subscriptions[0].topics[0]': 9,
      'webhooks.subscriptions[0].topics[1]': 9,
      'webhooks.subscriptions[0].uri': 9,
      'webhooks.subscriptions[1].uri': 9,
    })
  })

  test('ignores key-like text inside strings and comments', () => {
    const lines = locateTomlValues(`# uri = "http://comment.example"
first = "value # not a comment = still the value"
second = """
uri = "http://multi-line.example"
[[webhooks.subscriptions]]
escaped quote \\""" and the end"""
third = '''
uri = 'http://literal.example' ''
'''
path = 'C:\\no\\escapes'
fourth = 4
`)

    expect(Object.fromEntries(lines)).toEqual({first: 2, second: 3, third: 7, path: 10, fourth: 11})
  })

  test('reads CRLF line endings, dates with a space, and other scalars', () => {
    const lines = locateTomlValues(
      '[dates]\r\nlocal = 1979-05-27 07:32:00Z\r\nflag = true # comment\r\nnumbers = [1, -2]\r\nratio = 2.5\r\nempty = {}\r\nnext = "x"\r\n',
    )

    expect(Object.fromEntries(lines)).toEqual({
      'dates.local': 2,
      'dates.flag': 3,
      'dates.numbers[0]': 4,
      'dates.numbers[1]': 4,
      'dates.ratio': 5,
      'dates.next': 7,
    })
  })

  test('keeps the lines before a construct it does not read and gives no line after it', () => {
    const lines = locateTomlValues(`[auth]
redirect_urls = ["http://a.example/callback"]
"escaped\\u0041key" = 1
[webhooks]
api_version = "2026-07"
`)

    expect(Object.fromEntries(lines)).toEqual({'auth.redirect_urls[0]': 2})
  })

  test('returns no lines for empty content', () => {
    expect(locateTomlValues('').size).toBe(0)
  })

  test.each([
    ['arrays', '[', ']'],
    ['inline tables', '{value = ', '}'],
  ])('keeps earlier locations when deeply nested %s exceed the limit', (_name, open, close) => {
    const nestedValue = `${open.repeat(5000)}1${close.repeat(5000)}`
    const content = `before = "keep this location"\nnested = ${nestedValue}\nafter = "no location"\n`

    expect(decodeToml(content)).toMatchObject({before: 'keep this location', after: 'no location'})
    expect(Object.fromEntries(locateTomlValues(content))).toEqual({before: 1})
  })
})

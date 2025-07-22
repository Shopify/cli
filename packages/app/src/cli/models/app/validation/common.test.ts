import {validateUrl, validateRelativeUrl} from './common.js'
import {describe, expect, test} from 'vitest'
import {zod} from '@shopify/cli-kit/node/schema'

describe('validateUrl', () => {
  test('accepts valid HTTPS URLs', () => {
    const schema = zod.object({url: validateUrl(zod.string())})
    expect(() => schema.parse({url: 'https://example.com'})).not.toThrow()
  })

  test('accepts valid HTTP URLs when httpsOnly is false', () => {
    const schema = zod.object({url: validateUrl(zod.string(), {httpsOnly: false})})
    expect(() => schema.parse({url: 'http://example.com'})).not.toThrow()
  })

  test('rejects HTTP URLs when httpsOnly is true', () => {
    const schema = zod.object({url: validateUrl(zod.string(), {httpsOnly: true})})
    expect(() => schema.parse({url: 'http://example.com'})).toThrow()
  })

  test('rejects invalid URLs', () => {
    const schema = zod.object({url: validateUrl(zod.string())})
    expect(() => schema.parse({url: 'not-a-url'})).toThrow()
  })

  test('rejects URLs with newlines', () => {
    const schema = zod.object({url: validateUrl(zod.string())})
    expect(() => schema.parse({url: 'https://example.com\n/path'})).toThrow()
  })
})

describe('validateRelativeUrl', () => {
  test('accepts relative URLs starting with /', () => {
    const schema = zod.object({url: validateRelativeUrl(zod.string())})
    expect(() => schema.parse({url: '/api/endpoint'})).not.toThrow()
    expect(() => schema.parse({url: '/'})).not.toThrow()
    expect(() => schema.parse({url: '/path/to/resource'})).not.toThrow()
  })

  test('rejects HTTP URLs (only HTTPS allowed)', () => {
    const schema = zod.object({url: validateRelativeUrl(zod.string())})
    expect(() => schema.parse({url: 'http://example.com'})).toThrow()
    expect(() => schema.parse({url: 'http://example.com/path'})).toThrow()
  })

  test('accepts valid HTTPS URLs', () => {
    const schema = zod.object({url: validateRelativeUrl(zod.string())})
    expect(() => schema.parse({url: 'https://example.com'})).not.toThrow()
    expect(() => schema.parse({url: 'https://example.com/path'})).not.toThrow()
  })

  test('rejects URLs that do not start with / and are not valid URLs', () => {
    const schema = zod.object({url: validateRelativeUrl(zod.string())})
    expect(() => schema.parse({url: 'not-a-url'})).toThrow()
    expect(() => schema.parse({url: 'example.com'})).toThrow()
    expect(() => schema.parse({url: 'ftp://example.com'})).toThrow()
  })
})

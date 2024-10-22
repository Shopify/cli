import {shouldLog} from './log-request-line.js'
import {createEvent} from 'h3'
import {describe, test, expect} from 'vitest'
import {IncomingMessage, ServerResponse} from 'node:http'
import {Socket} from 'node:net'

function createH3Event(method = 'GET', path = '/', headers = {}) {
  const req = new IncomingMessage(new Socket())
  const res = new ServerResponse(req)

  req.method = method
  req.url = path
  req.headers = headers

  return createEvent(req, res)
}

describe('shouldLog', () => {
  test('returns false for paths with ignored prefixes', () => {
    const event = createH3Event('GET', '/checkouts/some-path')
    expect(shouldLog(event)).toBe(false)
  })

  test('returns false for paths with ignored extensions', () => {
    const event = createH3Event('GET', '/assets/styles.css')
    expect(shouldLog(event)).toBe(false)
  })

  test('returns true for paths without ignored prefixes or extensions', () => {
    const event = createH3Event('GET', '/products/some-product')
    expect(shouldLog(event)).toBe(true)
  })

  test('returns false for paths with query parameters and ignored extensions', () => {
    const event = createH3Event('GET', '/assets/script.js?version=1.2.3')
    expect(shouldLog(event)).toBe(false)
  })

  test('returns true for paths with query parameters and no ignored extensions', () => {
    const event = createH3Event('GET', '/products/some-product?variant=123')
    expect(shouldLog(event)).toBe(true)
  })

  test('returns false for paths with EXTENSION_CDN_PREFIX', () => {
    const event = createH3Event('GET', '/cdn/extension/some-path')
    expect(shouldLog(event)).toBe(false)
  })

  test('returns false for paths with VANITY_CDN_PREFIX', () => {
    const event = createH3Event('GET', '/cdn/vanity/some-path')
    expect(shouldLog(event)).toBe(false)
  })
})

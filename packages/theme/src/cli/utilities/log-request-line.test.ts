import {logRequestLine, shouldLog} from './log-request-line.js'
import {DevSessionOutput} from '../ui/DevSessionOutput.js'
import {palette} from '../ui/palette.js'
import {createEvent} from 'h3'
import {describe, test, expect, vi} from 'vitest'
import * as output from '@shopify/cli-kit/node/output'
import {unstyled} from '@shopify/cli-kit/node/output'
import colors from '@shopify/cli-kit/node/colors'
import {IncomingMessage, ServerResponse} from 'node:http'

import {Socket} from 'node:net'

import type {DevServerContext} from './theme-environment/types.js'

function createH3Event(method = 'GET', path = '/', headers = {}) {
  const req = new IncomingMessage(new Socket())
  const res = new ServerResponse(req)

  req.method = method
  req.url = path
  req.headers = headers

  return createEvent(req, res)
}

function fakeResponse(status = 200) {
  return {status, headers: {get: () => null}}
}

function fakeCtx(overrides?: Partial<DevServerContext>): DevServerContext {
  return {type: 'theme', ...overrides} as unknown as DevServerContext
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

describe('logRequestLine', () => {
  test('writes the access-log line to stderr via outputInfo when no sink is provided', () => {
    // Given
    const outputInfoSpy = vi.spyOn(output, 'outputInfo').mockImplementation(() => {})
    const event = createH3Event('GET', '/products/some-product')

    // When
    logRequestLine(event, fakeResponse(200), fakeCtx())

    // Then
    expect(outputInfoSpy).toHaveBeenCalledTimes(1)
  })

  test('routes the access-log line into the sink and not to stderr when a sink is provided', () => {
    // Given
    const outputInfoSpy = vi.spyOn(output, 'outputInfo').mockImplementation(() => {})
    const sink = new DevSessionOutput()
    const logSpy = vi.spyOn(sink, 'log')
    const event = createH3Event('GET', '/products/some-product')

    // When
    logRequestLine(event, fakeResponse(200), fakeCtx({sink}))

    // Then
    expect(logSpy).toHaveBeenCalledTimes(1)
    expect(logSpy.mock.calls[0]?.[0]).toContain('/products/some-product')
    expect(outputInfoSpy).not.toHaveBeenCalled()
  })

  test('emits a clean-columns line with method, padded status and path, without the old bullet/label', () => {
    // Given
    const sink = new DevSessionOutput()
    const logSpy = vi.spyOn(sink, 'log')
    const event = createH3Event('GET', '/')

    // When
    logRequestLine(event, fakeResponse(200), fakeCtx({sink}))

    // Then
    const raw = logSpy.mock.calls[0]?.[0] ?? ''
    const plain = unstyled(raw)
    // No legacy bullet or "Request »" label.
    expect(plain).not.toContain('•')
    expect(plain).not.toContain('Request »')
    // Columnar layout: method padEnd(5) then a 2-space column gap (GET + 2 pad
    // + 2 gap = 4 spaces), status padEnd(3), one space, then the path.
    expect(plain).toContain('GET    200 /')
    // Single row — no newline.
    expect(raw).not.toContain('\n')
  })

  test('colors the HTTP method per verb', () => {
    const sink = new DevSessionOutput()
    const logSpy = vi.spyOn(sink, 'log')

    logRequestLine(createH3Event('GET', '/a'), fakeResponse(200), fakeCtx({sink}))
    logRequestLine(createH3Event('POST', '/b'), fakeResponse(200), fakeCtx({sink}))
    logRequestLine(createH3Event('DELETE', '/c'), fakeResponse(200), fakeCtx({sink}))

    const getLine = logSpy.mock.calls[0]?.[0] ?? ''
    const postLine = logSpy.mock.calls[1]?.[0] ?? ''
    const deleteLine = logSpy.mock.calls[2]?.[0] ?? ''

    expect(getLine).toContain(colors.hex(palette.methods.get)('GET  '))
    expect(postLine).toContain(colors.hex(palette.methods.post)('POST '))
    expect(deleteLine).toContain(colors.hex(palette.methods.delete)('DELETE'))
  })

  test('colors the status per class using the status palette', () => {
    const sink = new DevSessionOutput()
    const logSpy = vi.spyOn(sink, 'log')

    logRequestLine(createH3Event('GET', '/ok'), fakeResponse(200), fakeCtx({sink}))
    logRequestLine(createH3Event('GET', '/redirect'), fakeResponse(302), fakeCtx({sink}))
    logRequestLine(createH3Event('GET', '/error'), fakeResponse(500), fakeCtx({sink}))

    expect(logSpy.mock.calls[0]?.[0]).toContain(colors.hex(palette.status.success)('200'))
    expect(logSpy.mock.calls[1]?.[0]).toContain(colors.hex(palette.status.redirect)('302'))
    expect(logSpy.mock.calls[2]?.[0]).toContain(colors.hex(palette.status.error)('500'))
  })

  test('respects the theme-extension early return regardless of sink', () => {
    // Given
    const outputInfoSpy = vi.spyOn(output, 'outputInfo').mockImplementation(() => {})
    const sink = new DevSessionOutput()
    const logSpy = vi.spyOn(sink, 'log')
    const event = createH3Event('GET', '/products/some-product')

    // When
    logRequestLine(event, fakeResponse(200), fakeCtx({sink, type: 'theme-extension'}))

    // Then
    expect(logSpy).not.toHaveBeenCalled()
    expect(outputInfoSpy).not.toHaveBeenCalled()
  })
})

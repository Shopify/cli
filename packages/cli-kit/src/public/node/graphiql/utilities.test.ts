import {filterCustomHeaders} from './utilities.js'
import {describe, expect, test} from 'vitest'

describe('filterCustomHeaders', () => {
  test('allows custom headers that are not blocked', () => {
    const headers = {
      'x-custom-header': 'custom-value',
      'x-another-header': 'another-value',
    }

    const result = filterCustomHeaders(headers)

    expect(result).toEqual({
      'x-custom-header': 'custom-value',
      'x-another-header': 'another-value',
    })
  })

  test('blocks hop-by-hop headers', () => {
    const headers = {
      connection: 'keep-alive',
      'keep-alive': 'timeout=5',
      'transfer-encoding': 'chunked',
      'x-custom-header': 'custom-value',
    }

    const result = filterCustomHeaders(headers)

    expect(result).toEqual({
      'x-custom-header': 'custom-value',
    })
  })

  test('blocks proxy-controlled headers', () => {
    const headers = {
      host: 'localhost:3000',
      'content-type': 'application/json',
      accept: 'application/json',
      'user-agent': 'Mozilla/5.0',
      authorization: 'Bearer token',
      cookie: 'session=abc',
      'x-shopify-access-token': 'secret-token',
      'x-custom-header': 'custom-value',
    }

    const result = filterCustomHeaders(headers)

    expect(result).toEqual({
      'x-custom-header': 'custom-value',
    })
  })

  test('blocks headers case-insensitively', () => {
    const headers = {
      Connection: 'keep-alive',
      HOST: 'localhost',
      'Content-Type': 'application/json',
      'X-Custom-Header': 'custom-value',
    }

    const result = filterCustomHeaders(headers)

    expect(result).toEqual({
      'X-Custom-Header': 'custom-value',
    })
  })

  test('filters out non-string header values', () => {
    const headers: {[key: string]: string | string[] | undefined} = {
      'x-custom-header': 'custom-value',
      'x-array-header': ['value1', 'value2'],
      'x-undefined-header': undefined,
    }

    const result = filterCustomHeaders(headers)

    expect(result).toEqual({
      'x-custom-header': 'custom-value',
    })
  })

  test('returns empty object when all headers are blocked', () => {
    const headers = {
      host: 'localhost',
      connection: 'keep-alive',
      'content-type': 'application/json',
    }

    const result = filterCustomHeaders(headers)

    expect(result).toEqual({})
  })

  test('returns empty object for empty input', () => {
    const result = filterCustomHeaders({})

    expect(result).toEqual({})
  })
})

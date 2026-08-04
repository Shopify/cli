import {encodeStoreExecuteWriteReceipt, encodeStoreExecuteResult} from './codec.js'
import {describe, expect, test} from 'vitest'

describe('store execute codecs', () => {
  test('encodes only operation data for the result payload', () => {
    expect(
      encodeStoreExecuteResult({
        data: {shop: {name: 'Test shop'}},
        failure: {code: 'USER_ERRORS', details: [{message: 'Rejected'}]},
      }),
    ).toBe(`{
  "shop": {
    "name": "Test shop"
  }
}`)
  })

  test('omits failureCode from a successful output document', () => {
    expect(encodeStoreExecuteWriteReceipt({outputFile: 'results.json', result: {data: {ok: true}}})).toBe(`{
  "outputFile": "results.json",
  "success": true
}`)
  })

  test('includes failureCode only for a failed output document', () => {
    expect(
      encodeStoreExecuteWriteReceipt({
        outputFile: 'results.json',
        result: {data: {ok: false}, failure: {code: 'USER_ERRORS', details: []}},
      }),
    ).toBe(`{
  "outputFile": "results.json",
  "success": false,
  "failureCode": "USER_ERRORS"
}`)
  })
})

import {encodeStoreExecuteWriteReceipt, encodeStoreExecuteResult} from './codec.js'
import {describe, expect, test} from 'vitest'

describe('store execute codecs', () => {
  test('encodes only operation data for the result payload', () => {
    expect(encodeStoreExecuteResult({data: {shop: {name: 'Test shop'}}})).toBe(`{
  "shop": {
    "name": "Test shop"
  }
}`)
  })

  test('encodes the output file in a write receipt', () => {
    expect(encodeStoreExecuteWriteReceipt({outputFile: 'results.json'})).toBe(`{
  "outputFile": "results.json"
}`)
  })
})

import {TestCase} from './test.js'
import {describe, expect, test} from 'vitest'

describe('generate-test', () => {
  test('TestCase interface matches expected structure', () => {
    // Given
    const testCase: TestCase = {
      name: 'test-discount-calculation',
      input: {
        productId: '123',
        quantity: 2,
      },
      expected: {
        discount: 10,
        discountedPrice: 90,
      },
      export: 'run',
    }

    // Then
    expect(testCase.name).toBe('test-discount-calculation')
    expect(testCase.input).toEqual({productId: '123', quantity: 2})
    expect(testCase.expected).toEqual({discount: 10, discountedPrice: 90})
    expect(testCase.export).toBe('run')
  })

  test('TestCase can have optional export field', () => {
    // Given
    const testCase: TestCase = {
      name: 'test-without-export',
      input: {data: 'test'},
      expected: {result: 'success'},
    }

    // Then
    expect(testCase.export).toBeUndefined()
  })
})

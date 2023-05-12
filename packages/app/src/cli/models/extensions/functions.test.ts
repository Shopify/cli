import {FunctionInstance} from './functions.js'
import {describe, expect, test} from 'vitest'

const FUNCTION_A = new FunctionInstance({
  configuration: {
    name: 'FUNCTION A',
    type: 'product_discounts',
    description: 'Function',
    build: {
      command: 'make build',
      path: 'dist/index.wasm',
    },
    configurationUi: false,
    apiVersion: '2022-07',
  },
  configurationPath: '/function/shopify.function.extension.toml',
  directory: '/function',
})

describe('graphQLType', () => {
  test('returns type when not using extensions framework', async () => {
    // When
    FUNCTION_A.usingExtensionsFramework = false
    const got = FUNCTION_A.graphQLType

    // Then
    expect(got).toEqual('PRODUCT_DISCOUNTS')
  })

  test('returns FUNCTION when using extensions framework', async () => {
    // When
    FUNCTION_A.usingExtensionsFramework = true
    const got = FUNCTION_A.graphQLType

    // Then
    expect(got).toEqual('FUNCTION')
  })
})

describe('type', () => {
  test('returns type when not using extensions framework', async () => {
    // When
    FUNCTION_A.usingExtensionsFramework = false
    const got = FUNCTION_A.type

    // Then
    expect(got).toEqual('product_discounts')
  })

  test('returns FUNCTION when using extensions framework', async () => {
    // When
    FUNCTION_A.usingExtensionsFramework = true
    const got = FUNCTION_A.type

    // Then
    expect(got).toEqual('function')
  })
})

describe('identifier', () => {
  test('returns identifier when not using extensions framework', async () => {
    // When
    FUNCTION_A.usingExtensionsFramework = false
    const got = FUNCTION_A.identifier

    // Then
    expect(got).toEqual('product_discounts')
  })

  test('returns FUNCTION when using extensions framework', async () => {
    // When
    FUNCTION_A.usingExtensionsFramework = true
    const got = FUNCTION_A.identifier

    // Then
    expect(got).toEqual('function')
  })
})

describe('externalType', () => {
  test('returns externalType when not using extensions framework', async () => {
    // When
    FUNCTION_A.usingExtensionsFramework = false
    const got = FUNCTION_A.externalType

    // Then
    expect(got).toEqual('product_discounts')
  })

  test('returns FUNCTION when using extensions framework', async () => {
    // When
    FUNCTION_A.usingExtensionsFramework = true
    const got = FUNCTION_A.externalType

    // Then
    expect(got).toEqual('function')
  })
})

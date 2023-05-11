import {FunctionExtension} from '../app/extensions.js'
import {testFunctionExtension} from '../app/app.test-data.js'
import {describe, expect, test} from 'vitest'

describe('graphQLType', () => {
  test('returns type when not using extensions framework', async () => {
    // Given
    const functionA: FunctionExtension = await testFunctionExtension()

    // When
    functionA.usingExtensionsFramework = false
    const got = functionA.graphQLType

    // Then
    expect(got).toEqual('PRODUCT_DISCOUNTS')
  })

  test('returns FUNCTION when using extensions framework', async () => {
    // Given
    const functionA: FunctionExtension = await testFunctionExtension()

    // When
    functionA.usingExtensionsFramework = true
    const got = functionA.graphQLType

    // Then
    expect(got).toEqual('FUNCTION')
  })
})

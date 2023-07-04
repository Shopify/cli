import {loadFSExtensionsSpecifications} from './load-specifications.js'
import {testFunctionExtension} from '../app/app.test-data.js'
import {describe, test, expect} from 'vitest'

describe('allUISpecifications', () => {
  test('loads the specifications successfully', async () => {
    // When
    const got = await loadFSExtensionsSpecifications()

    // Then
    expect(got.length).not.toEqual(0)
  })
})

describe('allLocalSpecs', () => {
  test('loads the specifications successfully', async () => {
    // When
    const got = await loadFSExtensionsSpecifications()

    // Then
    expect(got.length).not.toEqual(0)
  })
})

describe('graphQLType', () => {
  test('returns type when not using extensions framework', async () => {
    // Given
    const functionA = await testFunctionExtension()

    // When
    functionA.usingExtensionsFramework = false
    const got = functionA.graphQLType

    // Then
    expect(got).toEqual('PRODUCT_DISCOUNTS')
  })

  test('returns FUNCTION when using extensions framework', async () => {
    // Given
    const functionA = await testFunctionExtension()

    // When
    functionA.usingExtensionsFramework = true
    const got = functionA.graphQLType

    // Then
    expect(got).toEqual('FUNCTION')
  })
})

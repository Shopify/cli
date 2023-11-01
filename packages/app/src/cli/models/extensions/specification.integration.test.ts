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
  test('returns FUNCTION', async () => {
    // Given
    const functionA = await testFunctionExtension()

    // When
    const got = functionA.graphQLType

    // Then
    expect(got).toEqual('FUNCTION')
  })
})

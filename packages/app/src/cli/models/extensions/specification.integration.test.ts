import {loadLocalExtensionsSpecifications} from './load-specifications.js'
import {AppSchema} from '../app/app.js'
import {describe, test, expect, beforeAll} from 'vitest'

// If the AppSchema is not instanced, the dynamic loading of loadLocalExtensionsSpecifications is not working
beforeAll(() => {
  const schema = AppSchema
})

describe('allUISpecifications', () => {
  test('loads the specifications successfully', async () => {
    // When
    const got = await loadLocalExtensionsSpecifications()

    // Then
    expect(got.length).not.toEqual(0)
  })
})

describe('allLocalSpecs', () => {
  test('loads the specifications successfully', async () => {
    // When
    const got = await loadLocalExtensionsSpecifications()

    // Then
    expect(got.length).not.toEqual(0)
  })
})

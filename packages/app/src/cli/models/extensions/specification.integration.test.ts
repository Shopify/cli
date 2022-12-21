import {
  loadFunctionSpecifications,
  loadLocalExtensionsSpecifications,
  loadThemeSpecifications,
  loadUIExtensionSpecifications,
} from './specifications.js'
import {describe, test, expect} from 'vitest'

describe('allUISpecifications', () => {
  test('loads the specifications successfully', async () => {
    // When
    const got = await loadUIExtensionSpecifications()

    // Then
    expect(got.length).not.toEqual(0)
  })
})

describe('allFunctionSpecifications', () => {
  test('loads the specifications successfully', async () => {
    // When
    const got = await loadFunctionSpecifications()

    // Then
    expect(got.length).not.toEqual(0)
  })
})

describe('allThemeSpecifications', () => {
  test('loads the specifications successfully', async () => {
    // When
    const got = await loadThemeSpecifications()

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

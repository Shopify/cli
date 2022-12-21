import {
<<<<<<< HEAD
  allLocalFunctionSpecifications,
  allLocalSpecs,
  allThemeSpecifications,
  allLocalUISpecifications,
=======
  loadFunctionSpecifications,
  loadLocalExtensionsSpecifications,
  loadThemeSpecifications,
  loadUIExtensionSpecifications,
>>>>>>> main
} from './specifications.js'
import {describe, test, expect} from 'vitest'

describe('allUISpecifications', () => {
  test('loads the specifications successfully', async () => {
    // When
<<<<<<< HEAD
    const got = await allLocalUISpecifications()
=======
    const got = await loadUIExtensionSpecifications()
>>>>>>> main

    // Then
    expect(got.length).not.toEqual(0)
  })
})

describe('allFunctionSpecifications', () => {
  test('loads the specifications successfully', async () => {
    // When
<<<<<<< HEAD
    const got = await allLocalFunctionSpecifications()
=======
    const got = await loadFunctionSpecifications()
>>>>>>> main

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

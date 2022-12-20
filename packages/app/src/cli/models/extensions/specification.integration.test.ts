import {
  allLocalFunctionSpecifications,
  allLocalSpecs,
  allThemeSpecifications,
  allLocalUISpecifications,
} from './specifications.js'
import {describe, test, expect} from 'vitest'

describe('allUISpecifications', () => {
  test('loads the specifications successfully', async () => {
    // When
    const got = await allLocalUISpecifications()

    // Then
    expect(got.length).not.toEqual(0)
  })
})

describe('allFunctionSpecifications', () => {
  test('loads the specifications successfully', async () => {
    // When
    const got = await allLocalFunctionSpecifications()

    // Then
    expect(got.length).not.toEqual(0)
  })
})

describe('allThemeSpecifications', () => {
  test('loads the specifications successfully', async () => {
    // When
    const got = await allThemeSpecifications()

    // Then
    expect(got.length).not.toEqual(0)
  })
})

describe('allLocalSpecs', () => {
  test('loads the specifications successfully', async () => {
    // When
    const got = await allLocalSpecs()

    // Then
    expect(got.length).not.toEqual(0)
  })
})

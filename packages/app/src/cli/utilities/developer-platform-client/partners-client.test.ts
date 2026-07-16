import {PartnersClient} from './partners-client.js'
import {describe, expect, test, beforeEach} from 'vitest'

beforeEach(() => {
  // Reset the singleton instance before each test
  PartnersClient.resetInstance()
})

describe('PartnersClient', () => {
  describe('bundleFormat', () => {
    test('uses zip format', () => {
      // Given
      const client = PartnersClient.getInstance()

      // Then
      expect(client.bundleFormat).toBe('zip')
    })
  })
})

describe('singleton pattern', () => {
  test('getInstance returns the same instance', () => {
    // Given/When
    const instance1 = PartnersClient.getInstance()
    const instance2 = PartnersClient.getInstance()

    // Then
    expect(instance1).toBe(instance2)
  })

  test('resetInstance allows creating a new instance', () => {
    // Given
    const instance1 = PartnersClient.getInstance()

    // When
    PartnersClient.resetInstance()
    const instance2 = PartnersClient.getInstance()

    // Then
    expect(instance1).not.toBe(instance2)
  })
})

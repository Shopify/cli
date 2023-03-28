import {Environment, serviceEnvironment} from './service.js'
import {expect, test, describe} from 'vitest'

describe('serviceEnvironment', () => {
  test('returns local when the environment variable points to the local environment', () => {
    // Given
    const env = {SHOPIFY_SERVICE_ENV: 'local'}

    // When
    const got = serviceEnvironment(env)

    // Then
    expect(got).toBe(Environment.Local)
  })

  test('returns Spin when the environment variable points to the spin environment', () => {
    // Given
    const env = {SHOPIFY_SERVICE_ENV: 'spin'}

    // When
    const got = serviceEnvironment(env)

    // Then
    expect(got).toBe(Environment.Spin)
  })

  test('returns Production when the environment variable points to the production environment', () => {
    // Given
    const env = {SHOPIFY_SERVICE_ENV: 'production'}

    // When
    const got = serviceEnvironment(env)

    // Then
    expect(got).toBe(Environment.Production)
  })

  test("returns Production when the environment variable doesn't exist", () => {
    // Given
    const env = {}

    // When
    const got = serviceEnvironment(env)

    // Then
    expect(got).toBe(Environment.Production)
  })

  test('returns spin when environment variable SPIN is 1', () => {
    // Given
    const env = {SPIN: '1'}

    // When
    const got = serviceEnvironment(env)

    // Then
    expect(got).toBe(Environment.Spin)
  })
})

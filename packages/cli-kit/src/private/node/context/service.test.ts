import {Environment, serviceEnvironment} from './service.js'
import {expect, it, describe} from 'vitest'

describe('serviceEnvironment', () => {
  it('returns local when the environment variable points to the local environment', () => {
    // Given
    const env = {SHOPIFY_SERVICE_ENV: 'local'}

    // When
    const got = serviceEnvironment(env)

    // Then
    expect(got).toBe(Environment.Local)
  })

  it('returns Spin when the environment variable points to the spin environment', () => {
    // Given
    const env = {SHOPIFY_SERVICE_ENV: 'spin'}

    // When
    const got = serviceEnvironment(env)

    // Then
    expect(got).toBe(Environment.Spin)
  })

  it('returns Production when the environment variable points to the production environment', () => {
    // Given
    const env = {SHOPIFY_SERVICE_ENV: 'production'}

    // When
    const got = serviceEnvironment(env)

    // Then
    expect(got).toBe(Environment.Production)
  })

  it("returns Production when the environment variable doesn't exist", () => {
    // Given
    const env = {}

    // When
    const got = serviceEnvironment(env)

    // Then
    expect(got).toBe(Environment.Production)
  })

  it('returns spin when environment variable SPIN is 1', () => {
    // Given
    const env = {SPIN: '1'}

    // When
    const got = serviceEnvironment(env)

    // Then
    expect(got).toBe(Environment.Spin)
  })
})

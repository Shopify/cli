import {isSpinEnvironment, serviceEnvironment} from './service.js'
import {Environment} from '../network/service.js'
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

describe('isSpinEnvironment', () => {
  it('returns true when running against SPIN instance', () => {
    // Given
    process.env = {...process.env, SHOPIFY_SERVICE_ENV: 'spin'}

    // When
    const got = isSpinEnvironment()

    // Then
    expect(got).toBe(true)
  })

  it('returns true when running inside a SPIN instance', () => {
    // Given
    process.env = {...process.env, SPIN: '1'}

    // When
    const got = isSpinEnvironment()

    // Then
    expect(got).toBe(true)
  })

  it('returns false when not working with spin instances', () => {
    // Given
    process.env = {...process.env, SHOPIFY_SERVICE_ENV: 'local'}

    // When
    const got = isSpinEnvironment()

    // Then
    expect(got).toBe(false)
  })
})

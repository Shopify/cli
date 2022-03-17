import {partners, shopify, identity} from './service'
import {Environment} from '../network/service'
import {expect, it, describe} from 'vitest'

describe('partners', () => {
  it('returns local when the environment variable points to the local environment', () => {
    // Given
    const env = {SHOPIFY_PARTNERS_ENV: 'local'}

    // When
    const got = partners(env)

    // Then
    expect(got).toBe(Environment.Local)
  })

  it('returns Spin when the environment variable points to the spin environment', () => {
    // Given
    const env = {SHOPIFY_PARTNERS_ENV: 'spin'}

    // When
    const got = partners(env)

    // Then
    expect(got).toBe(Environment.Spin)
  })

  it('returns Production when the environment variable points to the production environment', () => {
    // Given
    const env = {SHOPIFY_PARTNERS_ENV: 'production'}

    // When
    const got = partners(env)

    // Then
    expect(got).toBe(Environment.Production)
  })

  it("returns Production when the environment variable doesn't exist", () => {
    // Given
    const env = {}

    // When
    const got = partners(env)

    // Then
    expect(got).toBe(Environment.Production)
  })
})

describe('shopify', () => {
  it('returns local when the environment variable points to the local environment', () => {
    // Given
    const env = {SHOPIFY_SHOPIFY_ENV: 'local'}

    // When
    const got = shopify(env)

    // Then
    expect(got).toBe(Environment.Local)
  })

  it('returns Spin when the environment variable points to the spin environment', () => {
    // Given
    const env = {SHOPIFY_SHOPIFY_ENV: 'spin'}

    // When
    const got = shopify(env)

    // Then
    expect(got).toBe(Environment.Spin)
  })

  it('returns Production when the environment variable points to the production environment', () => {
    // Given
    const env = {SHOPIFY_SHOPIFY_ENV: 'production'}

    // When
    const got = shopify(env)

    // Then
    expect(got).toBe(Environment.Production)
  })

  it("returns Production when the environment variable doesn't exist", () => {
    // Given
    const env = {}

    // When
    const got = shopify(env)

    // Then
    expect(got).toBe(Environment.Production)
  })
})

describe('identity', () => {
  it('returns local when the environment variable points to the local environment', () => {
    // Given
    const env = {SHOPIFY_IDENTITY_ENV: 'local'}

    // When
    const got = identity(env)

    // Then
    expect(got).toBe(Environment.Local)
  })

  it('returns Spin when the environment variable points to the spin environment', () => {
    // Given
    const env = {SHOPIFY_IDENTITY_ENV: 'spin'}

    // When
    const got = identity(env)

    // Then
    expect(got).toBe(Environment.Spin)
  })

  it('returns Production when the environment variable points to the production environment', () => {
    // Given
    const env = {SHOPIFY_IDENTITY_ENV: 'production'}

    // When
    const got = identity(env)

    // Then
    expect(got).toBe(Environment.Production)
  })

  it("returns Production when the environment variable doesn't exist", () => {
    // Given
    const env = {}

    // When
    const got = identity(env)

    // Then
    expect(got).toBe(Environment.Production)
  })
})

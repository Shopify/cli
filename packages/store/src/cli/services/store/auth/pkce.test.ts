import {STORE_AUTH_APP_CLIENT_ID} from './config.js'
import {buildStoreAuthUrl, computeCodeChallenge, generateCodeVerifier} from './pkce.js'
import {describe, expect, test} from 'vitest'

describe('store auth PKCE helpers', () => {
  test('generateCodeVerifier produces a base64url string of 43 chars', () => {
    const verifier = generateCodeVerifier()
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  test('generateCodeVerifier produces unique values', () => {
    const first = generateCodeVerifier()
    const second = generateCodeVerifier()
    expect(first).not.toBe(second)
  })

  test('computeCodeChallenge produces a deterministic S256 hash', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    const expected = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
    expect(computeCodeChallenge(verifier)).toBe(expected)
  })

  test('buildStoreAuthUrl includes PKCE params and response_type=code', () => {
    const url = new URL(
      buildStoreAuthUrl({
        store: 'shop.myshopify.com',
        scopes: ['read_products', 'write_products'],
        state: 'state-123',
        redirectUri: 'http://127.0.0.1:13387/auth/callback',
        codeChallenge: 'test-challenge-value',
      }),
    )

    expect(url.hostname).toBe('shop.myshopify.com')
    expect(url.pathname).toBe('/admin/oauth/authorize')
    expect(url.searchParams.get('client_id')).toBe(STORE_AUTH_APP_CLIENT_ID)
    expect(url.searchParams.get('scope')).toBe('read_products,write_products')
    expect(url.searchParams.get('state')).toBe('state-123')
    expect(url.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:13387/auth/callback')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('code_challenge')).toBe('test-challenge-value')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('grant_options[]')).toBeNull()
  })
})

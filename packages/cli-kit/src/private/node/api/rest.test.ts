import {isThemeAccessSession, restRequestBody, restRequestHeaders, restRequestUrl} from './rest.js'
import {themeKitAccessDomain} from '../constants.js'
import {AdminSession} from '../../../public/node/session.js'
import {test, expect, describe} from 'vitest'

const customAppSession: AdminSession = {token: 'shpat_token', storeFqdn: 'my-shop.myshopify.com'}
const themeAccessSession: AdminSession = {token: 'shptka_token', storeFqdn: 'my-shop.myshopify.com'}

describe('isThemeAccessSession', () => {
  test('is true when the token is a Theme Access password', () => {
    expect(isThemeAccessSession(themeAccessSession)).toBe(true)
  })

  test('is false for any other token', () => {
    expect(isThemeAccessSession(customAppSession)).toBe(false)
  })
})

describe('restRequestBody', () => {
  test('returns undefined when there is no body', () => {
    expect(restRequestBody(undefined)).toBeUndefined()
  })

  test('serializes the body as JSON', () => {
    expect(restRequestBody({theme: {name: 'My theme'}})).toBe('{"theme":{"name":"My theme"}}')
  })
})

describe('restRequestUrl', () => {
  test('builds a store Admin API url', () => {
    // When
    const url = restRequestUrl(customAppSession, 'unstable', '/themes')

    // Then
    expect(url).toBe('https://my-shop.myshopify.com/admin/api/unstable/themes.json')
  })

  test('routes through the Theme Access proxy for a Theme Access session', () => {
    // When
    const url = restRequestUrl(themeAccessSession, 'unstable', '/themes')

    // Then
    expect(url).toBe(`https://${themeKitAccessDomain}/cli/admin/api/unstable/themes.json`)
  })

  test('appends search params', () => {
    // When
    const url = restRequestUrl(customAppSession, 'unstable', '/themes', {fields: 'id,name', limit: '1'})

    // Then
    expect(url).toBe('https://my-shop.myshopify.com/admin/api/unstable/themes.json?fields=id%2Cname&limit=1')
  })
})

describe('restRequestHeaders', () => {
  test('adds the shop and access token headers for a Theme Access session', () => {
    // When
    const headers = restRequestHeaders(themeAccessSession)

    // Then
    expect(headers['X-Shopify-Shop']).toBe('my-shop.myshopify.com')
    expect(headers['X-Shopify-Access-Token']).toBe('shptka_token')
  })

  test('does not add the shop header for any other session', () => {
    // When
    const headers = restRequestHeaders(customAppSession)

    // Then
    expect(headers).not.toHaveProperty('X-Shopify-Shop')
    expect(headers['X-Shopify-Access-Token']).toBe('shpat_token')
  })
})

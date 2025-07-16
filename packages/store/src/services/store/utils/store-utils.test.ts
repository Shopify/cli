import {storeFullDomain} from './store-utils.js'
import {describe, expect, test} from 'vitest'

describe('store-utils', () => {
  describe('storeFullDomain', () => {
    test('works with full domain', () => {
      expect(storeFullDomain('shop.myshopify.com')).toBe('shop.myshopify.com')
    })

    test('works with shop handle', () => {
      expect(storeFullDomain('my-shop')).toBe('my-shop.myshopify.com')
    })
  })
})

import {extractShopifyComponents} from './extract-shopify-components.js'
import {describe, expect, test} from 'vitest'

// Pure regex over declaration text — no filesystem, no TypeScript, no cli-kit.

describe('extractShopifyComponents', () => {
  test('returns nothing without a package name', () => {
    expect(extractShopifyComponents('anything', undefined)).toStrictEqual([])
  })

  test('extracts web-component tag names from polaris-types declarations', () => {
    const content = `
      declare const tagName = 's-button';
      declare const tagName$1 = "s-avatar";
    `
    expect(extractShopifyComponents(content, '@shopify/polaris-types')).toStrictEqual(['s-button', 's-avatar'])
  })

  test('extracts bracket-keyed intrinsic element tags', () => {
    const content = `interface IntrinsicElements { ['s-customer-account-action']: unknown }`
    expect(extractShopifyComponents(content, '@shopify/ui-extensions')).toContain('s-customer-account-action')
  })

  test('extracts App Bridge custom elements from the AppBridgeElements interface', () => {
    const content = `interface AppBridgeElements { 'ui-modal': UIModalAttributes; 'ui-title-bar': UITitleBarAttributes }`
    expect(extractShopifyComponents(content, '@shopify/app-bridge-types')).toStrictEqual(['ui-modal', 'ui-title-bar'])
  })

  test('extracts React wrapper components from app-bridge-react declarations', () => {
    const content = `
      export declare const TitleBar: React.ComponentType<TitleBarProps>;
      export declare const Modal: React.ForwardRefExoticComponent<ModalProps>;
    `
    expect(extractShopifyComponents(content, '@shopify/app-bridge-react')).toStrictEqual(['TitleBar', 'Modal'])
  })

  test('returns nothing for an unrecognized package', () => {
    expect(extractShopifyComponents("declare const tagName = 's-button'", 'some-other-package')).toStrictEqual([])
  })
})

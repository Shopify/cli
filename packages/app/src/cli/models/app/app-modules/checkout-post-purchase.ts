/**
 * Checkout Post Purchase — trivial encode, validates the AppModule pattern for uuid extensions.
 */

import {AppModule, EncodeContext} from '../app-module.js'

interface CheckoutPostPurchaseToml {
  metafields?: {namespace: string; key: string}[]
  [key: string]: unknown
}

interface CheckoutPostPurchaseContract {
  metafields: {namespace: string; key: string}[]
}

export class CheckoutPostPurchaseModule extends AppModule<CheckoutPostPurchaseToml, CheckoutPostPurchaseContract> {
  constructor() {
    super({identifier: 'checkout_post_purchase', uidStrategy: 'uuid'})
  }

  async encode(toml: CheckoutPostPurchaseToml, _context: EncodeContext): Promise<CheckoutPostPurchaseContract> {
    return {metafields: toml.metafields ?? []}
  }
}

export const checkoutPostPurchaseModule = new CheckoutPostPurchaseModule()

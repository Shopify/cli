// Demo POS UI extension entry. Exercises every alias path the detector must
// handle. The `shopify` global is injected by the host at runtime.
declare const shopify: {intercept: (event: string, handler: () => void) => void}

import {registerCheckoutGuards} from './checkout.js'
import {block} from './aliased.js'

// 1. Direct call.
shopify.intercept('beforecheckout', () => {})

// 2. Aliased via `const fn = shopify.intercept` (declared before use).
const guard = shopify.intercept
guard('beforepayment', () => {})

// 3. Destructured: `const {intercept} = shopify`.
const {intercept} = shopify
intercept('beforediscount', () => {})

// 4. Destructured + renamed: `const {intercept: rename} = shopify`.
const {intercept: renamed} = shopify
renamed('beforerefund', () => {})

// 5. shopify object aliased, then member call: `const s = shopify; s.intercept(...)`.
const s = shopify
s.intercept('beforeexchange', () => {})

// 6. Reassignment of a let binding.
let later
later = shopify.intercept
later('beforevoid', () => {})

// 7. Cross-file re-exported intercept reference.
block('beforecancel', () => {})

// 8. Inside control flow — MUST still be detected (reachability ignored).
if (Math.random() > 0.5) {
  shopify.intercept('beforetax', () => {})
} else {
  shopify.intercept('beforeshipping', () => {})
}

// 9. UNRESOLVED: dynamic/computed event args — surfaced, never dropped.
const dynamicEvent = 'beforesomething'
shopify.intercept(dynamicEvent, () => {})
shopify.intercept(`before${'checkout'}`, () => {})

registerCheckoutGuards()

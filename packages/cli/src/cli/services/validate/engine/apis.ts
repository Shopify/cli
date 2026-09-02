// The API registries for `shopify validate <subcommand>`. This is the lean
// CLI-native replacement for the source package's large `SHOPIFY_APIS` mapping:
// each subcommand only needs the API identifiers it accepts (which double as the
// schema-file prefix, e.g. `admin_2026-04.json.gz` / `functions_discount_*`) plus
// a type guard. The full skill/instruction-generator fields from the source
// mapping are not needed and are not ported.
//
// The component API registry (`COMPONENT_APIS` + friends) carries extra
// component-engine-specific configuration (package lists, extension surfaces),
// so it lives in `engine/components/component-apis.ts` alongside the code that
// consumes it. We re-export its public identifiers here so this module remains
// the single discovery point for all three registries; the component-specific
// config helpers stay in the components module.

export {COMPONENT_APIS, COMPONENT_API_NAMES, isComponentApi, type ComponentApi} from './components/component-apis.js'

// ---------------------------------------------------------------------------
// GraphQL APIs
// ---------------------------------------------------------------------------

// The internal "bourgeois" API is intentionally excluded — it depends on
// internal-only data and is out of scope for the public CLI.
export const GRAPHQL_APIS = ['admin', 'storefront-graphql', 'customer', 'partner', 'payments-apps'] as const

export type GraphqlApi = (typeof GRAPHQL_APIS)[number]

/** Type guard: true when `value` is one of the supported public GraphQL APIs. */
export function isGraphqlApi(value: string): value is GraphqlApi {
  return (GRAPHQL_APIS as ReadonlyArray<string>).includes(value)
}

// ---------------------------------------------------------------------------
// Functions APIs
// ---------------------------------------------------------------------------

// The set of Shopify Functions APIs whose input queries the functions validator
// can check, mapped to their display names. A Functions schema file is named
// like `functions_discount_2026-04.json.gz`, so the API id doubles as the
// schema-file prefix.
export const FUNCTIONS_APIS = {
  functions_discount: 'Discount Function',
  functions_cart_transform: 'Cart Transform Function',
  functions_cart_checkout_validation: 'Cart Checkout Validation Function',
  functions_delivery_customization: 'Delivery Customization Function',
  functions_fulfillment_constraints: 'Fulfillment Constraints Function',
  functions_order_routing_location_rule: 'Order Routing Location Rule Function',
  functions_payment_customization: 'Payment Customization Function',
  functions_order_discounts: 'Order Discounts Function',
  functions_product_discounts: 'Product Discounts Function',
  functions_shipping_discounts: 'Shipping Discounts Function',
  functions_discounts_allocator: 'Discounts Allocator Function',
  functions_local_pickup_delivery_option_generator: 'Local Pickup Delivery Option Generator Function',
  functions_pickup_point_delivery_option_generator: 'Pickup Point Delivery Option Generator Function',
} as const

export type FunctionsApi = keyof typeof FUNCTIONS_APIS

/** All valid Functions API ids, in declaration order. */
export const FUNCTIONS_API_IDS = Object.keys(FUNCTIONS_APIS) as FunctionsApi[]

/** Type guard: is the given string a supported Functions API id? */
export function isFunctionsApi(value: string): value is FunctionsApi {
  return Object.prototype.hasOwnProperty.call(FUNCTIONS_APIS, value)
}

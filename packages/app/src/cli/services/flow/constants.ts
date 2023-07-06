// Metafield-like types for commerce objects
export const SUPPORTED_COMMERCE_OBJECTS = {
  customer_reference: 'customer_reference',
  order_reference: 'order_reference',
  product_reference: 'product_reference',
  marketing_activity_reference: 'marketing_activity_reference',
  abandonment_reference: 'abandonment_reference',
}

export const PARTNERS_COMMERCE_OBJECTS = ['customer', 'order', 'product', 'marketing_activity', 'abandonment']

export const TRIGGER_SUPPORTED_COMMERCE_OBJECTS = [
  SUPPORTED_COMMERCE_OBJECTS.customer_reference,
  SUPPORTED_COMMERCE_OBJECTS.order_reference,
  SUPPORTED_COMMERCE_OBJECTS.product_reference,
]

export const ACTION_SUPPORTED_COMMERCE_OBJECTS = [
  SUPPORTED_COMMERCE_OBJECTS.customer_reference,
  SUPPORTED_COMMERCE_OBJECTS.order_reference,
  SUPPORTED_COMMERCE_OBJECTS.product_reference,
  SUPPORTED_COMMERCE_OBJECTS.marketing_activity_reference,
  SUPPORTED_COMMERCE_OBJECTS.abandonment_reference,
]

// Mapping of metafield types to Flow's Partner's Dashboard UI types
// Only the `email` type was added since it doesn't exist as a metafield type
// https://shopify.dev/docs/apps/custom-data/metafields/types
export const uiTypesMap: [string, string][] = [
  ['boolean', 'checkbox'],
  ['email', 'email'],
  ['multi_line_text_field', 'text-multi-lines'],
  ['number_integer', 'int'],
  ['single_line_text_field', 'text-single-line'],
  ['url', 'url'],
  ['number_decimal', 'number'],
]

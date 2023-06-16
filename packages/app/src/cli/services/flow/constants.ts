// Metafield-like types for commerce objects
export const SUPPORTED_COMMERCE_OBJECTS = {
  customer_reference: 'customer_reference',
  order_reference: 'order_reference',
  product_reference: 'product_reference',
  marketing_activity_reference: 'marketing_activity_reference',
  abandonment_reference: 'abandonment_reference',
}

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

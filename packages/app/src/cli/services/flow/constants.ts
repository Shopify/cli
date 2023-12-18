// Metafield-like types for commerce objects
export const SUPPORTED_COMMERCE_OBJECTS = {
  customer_reference: 'customer_reference',
  order_reference: 'order_reference',
  product_reference: 'product_reference',
  marketing_activity_reference: 'marketing_activity_reference',
  abandonment_reference: 'abandonment_reference',
  company_reference: 'company_reference',
  company_contact_reference: 'company_contact_reference',
}

export const PARTNERS_COMMERCE_OBJECTS = [
  'customer',
  'order',
  'product',
  'marketing_activity',
  'abandonment',
  'company',
  'company_contact',
]

export const TRIGGER_SUPPORTED_COMMERCE_OBJECTS = [
  SUPPORTED_COMMERCE_OBJECTS.customer_reference,
  SUPPORTED_COMMERCE_OBJECTS.order_reference,
  SUPPORTED_COMMERCE_OBJECTS.product_reference,
  SUPPORTED_COMMERCE_OBJECTS.company_reference,
  SUPPORTED_COMMERCE_OBJECTS.company_contact_reference,
]

export const ACTION_SUPPORTED_COMMERCE_OBJECTS = [
  SUPPORTED_COMMERCE_OBJECTS.customer_reference,
  SUPPORTED_COMMERCE_OBJECTS.order_reference,
  SUPPORTED_COMMERCE_OBJECTS.product_reference,
  SUPPORTED_COMMERCE_OBJECTS.marketing_activity_reference,
  SUPPORTED_COMMERCE_OBJECTS.abandonment_reference,
  SUPPORTED_COMMERCE_OBJECTS.company_reference,
  SUPPORTED_COMMERCE_OBJECTS.company_contact_reference,
]

const UI_TYPES = {
  boolean: 'boolean',
  email: 'email',
  multiLineText: 'multi_line_text_field',
  int: 'number_integer',
  singleLineText: 'single_line_text_field',
  url: 'url',
  decimal: 'number_decimal',
  schemaTypeReference: 'schema_type_reference',
}

// Mapping of metafield types to Flow's Partner's Dashboard UI types
// Contains all types supported by actions and/or triggers
// Only the `email` type was added since it doesn't exist as a metafield type
// https://shopify.dev/docs/apps/custom-data/metafields/types
export const uiTypesMap: [string, string][] = [
  [UI_TYPES.boolean, 'checkbox'],
  [UI_TYPES.email, 'email'],
  [UI_TYPES.multiLineText, 'text-multi-line'],
  [UI_TYPES.int, 'int'],
  [UI_TYPES.singleLineText, 'text-single-line'],
  [UI_TYPES.url, 'url'],
  [UI_TYPES.decimal, 'number'],
  [UI_TYPES.schemaTypeReference, 'schema-type-reference'],
]

const supportedActionTypes: string[] = [
  UI_TYPES.boolean,
  UI_TYPES.email,
  UI_TYPES.multiLineText,
  UI_TYPES.int,
  UI_TYPES.singleLineText,
  UI_TYPES.url,
  UI_TYPES.decimal,
]
const supportedTriggerTypes: string[] = [
  UI_TYPES.boolean,
  UI_TYPES.email,
  UI_TYPES.singleLineText,
  UI_TYPES.url,
  UI_TYPES.decimal,
  UI_TYPES.schemaTypeReference,
]

export const actionUiTypesMap = uiTypesMap.filter(([key]) => supportedActionTypes.includes(key))
export const triggerUiTypesMap = uiTypesMap.filter(([key]) => supportedTriggerTypes.includes(key))

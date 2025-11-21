interface MetafieldsOptions {
  api_version: string
}

export interface ValidationRule {
  [key: string]: unknown
}

interface MetafieldCapabilities {
  admin_filterable?: boolean
}

interface MetafieldAccessControls {
  admin?: 'merchant_read' | 'merchant_read_write'
  storefront?: 'none' | 'public_read'
  customer_account?: 'none' | 'read' | 'read_write'
}

export interface Metafield {
  type: MetaFieldDefinitionTypes
  name?: string
  description?: string
  validations?: ValidationRule
  capabilities?: MetafieldCapabilities
  access?: MetafieldAccessControls
}

interface MetafieldsCollection {
  [key: string]: Metafield
}

interface OwnerTypeMetafieldNamespaces {
  app?: MetafieldsCollection
  [key: string]: MetafieldsCollection | undefined
}

interface OwnerTypeWithMetafields {
  metafields: OwnerTypeMetafieldNamespaces
}

interface MetaobjectFieldCapabilities {
  admin_filterable?: boolean
}

interface MetaobjectAccessControls {
  admin?: 'merchant_read' | 'merchant_read_write'
  storefront?: 'none' | 'public_read'
}

interface MetaobjectCapabilities {
  publishable?: boolean
  translatable?: boolean
  renderable?: boolean
  renderable_meta_title_field?: string
  renderable_meta_description_field?: string
}

// To handle all metafield types including pattern-based types like "metaobject_reference<...>"
type MetaFieldDefinitionTypes = string

export interface FieldObject {
  type: MetaFieldDefinitionTypes
  name?: string
  description?: string
  required?: boolean
  validations?: ValidationRule
  capabilities?: MetaobjectFieldCapabilities
}

interface MetaobjectFieldCollection {
  [key: string]: MetaFieldDefinitionTypes | FieldObject
}

export interface MetaObject {
  name?: string
  description?: string
  display_name_field?: string
  fields: MetaobjectFieldCollection
  capabilities?: MetaobjectCapabilities
  access?: MetaobjectAccessControls
}

interface MetaobjectsCollection {
  [key: string]: MetaObject
}

interface MetaobjectNamespaces {
  app?: MetaobjectsCollection
  standard_metaobjects?: string[]
}

// Root type - this is what you can cast parsed JSON to
export interface DeclarativeCustomDataDefinition {
  metafields?: MetafieldsOptions
  company?: OwnerTypeWithMetafields
  company_location?: OwnerTypeWithMetafields
  payment_customization?: OwnerTypeWithMetafields
  validation?: OwnerTypeWithMetafields
  customer?: OwnerTypeWithMetafields
  delivery_customization?: OwnerTypeWithMetafields
  draft_order?: OwnerTypeWithMetafields
  market?: OwnerTypeWithMetafields
  cart_transform?: OwnerTypeWithMetafields
  collection?: OwnerTypeWithMetafields
  product?: OwnerTypeWithMetafields
  variant?: OwnerTypeWithMetafields
  article?: OwnerTypeWithMetafields
  blog?: OwnerTypeWithMetafields
  page?: OwnerTypeWithMetafields
  fulfillment_constraint_rule?: OwnerTypeWithMetafields
  order_routing_location_rule?: OwnerTypeWithMetafields
  discount?: OwnerTypeWithMetafields
  order?: OwnerTypeWithMetafields
  location?: OwnerTypeWithMetafields
  shop?: OwnerTypeWithMetafields
  selling_plan?: OwnerTypeWithMetafields
  gift_card_transaction?: OwnerTypeWithMetafields
  delivery_method?: OwnerTypeWithMetafields
  delivery_option_generator?: OwnerTypeWithMetafields
  metaobjects?: MetaobjectNamespaces
}

export type MetafieldOwners = Exclude<keyof DeclarativeCustomDataDefinition, 'metafields' | 'metaobjects'>

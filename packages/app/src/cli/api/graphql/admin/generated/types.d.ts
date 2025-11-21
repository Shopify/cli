/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/naming-convention, @typescript-eslint/no-explicit-any, tsdoc/syntax  */
import {JsonMapType} from '@shopify/cli-kit/node/toml'

export type Maybe<T> = T | null
export type InputMaybe<T> = Maybe<T>
export type Exact<T extends {[key: string]: unknown}> = {[K in keyof T]: T[K]}
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {[SubKey in K]?: Maybe<T[SubKey]>}
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {[SubKey in K]: Maybe<T[SubKey]>}
export type MakeEmpty<T extends {[key: string]: unknown}, K extends keyof T> = {[_ in K]?: never}
export type Incremental<T> = T | {[P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never}
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: {input: string; output: string}
  String: {input: string; output: string}
  Boolean: {input: boolean; output: boolean}
  Int: {input: number; output: number}
  Float: {input: number; output: number}
  /**
   * An Amazon Web Services Amazon Resource Name (ARN), including the Region and account ID.
   * For more information, refer to [Amazon Resource Names](https://docs.aws.amazon.com/general/latest/gr/aws-arns-and-namespaces.html).
   */
  ARN: {input: any; output: any}
  /**
   * Represents non-fractional signed whole numeric values. Since the value may
   * exceed the size of a 32-bit integer, it's encoded as a string.
   */
  BigInt: {input: any; output: any}
  /**
   * A string containing a hexadecimal representation of a color.
   *
   * For example, "#6A8D48".
   */
  Color: {input: any; output: any}
  /**
   * Represents an [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601)-encoded date string.
   * For example, September 7, 2019 is represented as `"2019-07-16"`.
   */
  Date: {input: any; output: any}
  /**
   * Represents an [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601)-encoded date and time string.
   * For example, 3:50 pm on September 7, 2019 in the time zone of UTC (Coordinated Universal Time) is
   * represented as `"2019-09-07T15:50:00Z`".
   */
  DateTime: {input: any; output: any}
  /**
   * A signed decimal number, which supports arbitrary precision and is serialized as a string.
   *
   * Example values: `"29.99"`, `"29.999"`.
   */
  Decimal: {input: any; output: any}
  /**
   * A string containing a strict subset of HTML code. Non-allowed tags will be stripped out.
   * Allowed tags:
   * * `a` (allowed attributes: `href`, `target`)
   * * `b`
   * * `br`
   * * `em`
   * * `i`
   * * `strong`
   * * `u`
   * Use [HTML](https://shopify.dev/api/admin-graphql/latest/scalars/HTML) instead if you need to
   * include other HTML tags.
   *
   * Example value: `"Your current domain is <strong>example.myshopify.com</strong>."`
   */
  FormattedString: {input: any; output: any}
  /**
   * A string containing HTML code. Refer to the [HTML spec](https://html.spec.whatwg.org/#elements-3) for a
   * complete list of HTML elements.
   *
   * Example value: `"<p>Grey cotton knit sweater.</p>"`
   */
  HTML: {input: any; output: any}
  /**
   * A [JSON](https://www.json.org/json-en.html) object.
   *
   * Example value:
   * `{
   *   "product": {
   *     "id": "gid://shopify/Product/1346443542550",
   *     "title": "White T-shirt",
   *     "options": [{
   *       "name": "Size",
   *       "values": ["M", "L"]
   *     }]
   *   }
   * }`
   */
  JSON: {input: JsonMapType | string; output: JsonMapType}
  /** A monetary value string without a currency symbol or code. Example value: `"100.57"`. */
  Money: {input: any; output: any}
  /** A scalar value. */
  Scalar: {input: any; output: any}
  /**
   * Represents a unique identifier in the Storefront API. A `StorefrontID` value can
   * be used wherever an ID is expected in the Storefront API.
   *
   * Example value: `"Z2lkOi8vc2hvcGlmeS9Qcm9kdWN0LzEwMDc5Nzg1MTAw"`.
   */
  StorefrontID: {input: any; output: any}
  /**
   * Represents an [RFC 3986](https://datatracker.ietf.org/doc/html/rfc3986) and
   * [RFC 3987](https://datatracker.ietf.org/doc/html/rfc3987)-compliant URI string.
   *
   * For example, `"https://example.myshopify.com"` is a valid URL. It includes a scheme (`https`) and a host
   * (`example.myshopify.com`).
   */
  URL: {input: string; output: string}
  /**
   * An unsigned 64-bit integer. Represents whole numeric values between 0 and 2^64 - 1 encoded as a string of base-10 digits.
   *
   * Example value: `"50"`.
   */
  UnsignedInt64: {input: any; output: any}
  /**
   * Time between UTC time and a location's observed time, in the format `"+HH:MM"` or `"-HH:MM"`.
   *
   * Example value: `"-07:00"`.
   */
  UtcOffset: {input: any; output: any}
}

/** Metafield access permissions for the Admin API. */
export type MetafieldAdminAccess =
  /** The merchant has read-only access. No other apps have access. */
  | 'MERCHANT_READ'
  /** The merchant has read and write access. No other apps have access. */
  | 'MERCHANT_READ_WRITE'
  /** The merchant and other apps have no access. */
  | 'PRIVATE'
  /** The merchant and other apps have read-only access. */
  | 'PUBLIC_READ'
  /** The merchant and other apps have read and write access. */
  | 'PUBLIC_READ_WRITE'

/** Metafield access permissions for the Customer Account API. */
export type MetafieldCustomerAccountAccess =
  /** No access. */
  | 'NONE'
  /** Read-only access. */
  | 'READ'
  /** Read and write access. */
  | 'READ_WRITE'

/** Possible types of a metafield's owner resource. */
export type MetafieldOwnerType =
  /** The Api Permission metafield owner type. */
  | 'API_PERMISSION'
  /** The Article metafield owner type. */
  | 'ARTICLE'
  /** The Blog metafield owner type. */
  | 'BLOG'
  /** The Cart Transform metafield owner type. */
  | 'CARTTRANSFORM'
  /** The Collection metafield owner type. */
  | 'COLLECTION'
  /** The Company metafield owner type. */
  | 'COMPANY'
  /** The Company Location metafield owner type. */
  | 'COMPANY_LOCATION'
  /** The Customer metafield owner type. */
  | 'CUSTOMER'
  /** The Delivery Customization metafield owner type. */
  | 'DELIVERY_CUSTOMIZATION'
  /** The Delivery Method metafield owner type. */
  | 'DELIVERY_METHOD'
  /** The Delivery Option Generator metafield owner type. */
  | 'DELIVERY_OPTION_GENERATOR'
  /** The Discount metafield owner type. */
  | 'DISCOUNT'
  /** The draft order metafield owner type. */
  | 'DRAFTORDER'
  /** The Fulfillment Constraint Rule metafield owner type. */
  | 'FULFILLMENT_CONSTRAINT_RULE'
  /** The GiftCardTransaction metafield owner type. */
  | 'GIFT_CARD_TRANSACTION'
  /** The Location metafield owner type. */
  | 'LOCATION'
  /** The Market metafield owner type. */
  | 'MARKET'
  /** The Media Image metafield owner type. */
  | 'MEDIA_IMAGE'
  /** The Order metafield owner type. */
  | 'ORDER'
  /** The Order Routing Location Rule metafield owner type. */
  | 'ORDER_ROUTING_LOCATION_RULE'
  /** The Page metafield owner type. */
  | 'PAGE'
  /** The Payment Customization metafield owner type. */
  | 'PAYMENT_CUSTOMIZATION'
  /** The Product metafield owner type. */
  | 'PRODUCT'
  /** The Product Variant metafield owner type. */
  | 'PRODUCTVARIANT'
  /** The Selling Plan metafield owner type. */
  | 'SELLING_PLAN'
  /** The Shop metafield owner type. */
  | 'SHOP'
  /** The Validation metafield owner type. */
  | 'VALIDATION'

/** Metafield access permissions for the Storefront API. */
export type MetafieldStorefrontAccess =
  /** No access. */
  | 'NONE'
  /** Read-only access. */
  | 'PUBLIC_READ'

/**
 * Metaobject access permissions for the Admin API. When the metaobject is app-owned, the owning app always has
 * full access.
 */
export type MetaobjectAdminAccess =
  /** The merchant has read-only access. No other apps have access. */
  | 'MERCHANT_READ'
  /** The merchant has read and write access. No other apps have access. */
  | 'MERCHANT_READ_WRITE'
  /** The merchant and other apps have no access. */
  | 'PRIVATE'
  /** The merchant and other apps have read-only access. */
  | 'PUBLIC_READ'
  /** The merchant and other apps have read and write access. */
  | 'PUBLIC_READ_WRITE'

/** Metaobject access permissions for the Storefront API. */
export type MetaobjectStorefrontAccess =
  /** No access. */
  | 'NONE'
  /** Read-only access. */
  | 'PUBLIC_READ'

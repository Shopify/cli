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
  /** The Gate Configuration metafield owner type. */
  | 'GATE_CONFIGURATION'
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

/** The input fields for the theme file body. */
export type OnlineStoreThemeFileBodyInput = {
  /** The input type of the theme file body. */
  type: OnlineStoreThemeFileBodyInputType
  /** The body of the theme file. */
  value: Scalars['String']['input']
}

/** The input type for a theme file body. */
export type OnlineStoreThemeFileBodyInputType =
  /** The base64 encoded body of a theme file. */
  | 'BASE64'
  /** The text body of the theme file. */
  | 'TEXT'
  /** The url of the body of a theme file. */
  | 'URL'

/** Type of a theme file operation result. */
export type OnlineStoreThemeFileResultType =
  /** Operation was malformed or invalid. */
  | 'BAD_REQUEST'
  /** Operation faced a conflict with the current state of the file. */
  | 'CONFLICT'
  /** Operation encountered an error. */
  | 'ERROR'
  /** Operation file could not be found. */
  | 'NOT_FOUND'
  /** Operation was successful. */
  | 'SUCCESS'
  /** Operation timed out. */
  | 'TIMEOUT'
  /** Operation could not be processed due to issues with input data. */
  | 'UNPROCESSABLE_ENTITY'

/** The input fields for the file to create or update. */
export type OnlineStoreThemeFilesUpsertFileInput = {
  /** The body of the theme file. */
  body: OnlineStoreThemeFileBodyInput
  /** The filename of the theme file. */
  filename: Scalars['String']['input']
}

/** Possible error codes that can be returned by `OnlineStoreThemeFilesUserErrors`. */
export type OnlineStoreThemeFilesUserErrorsCode =
  /** Access denied. */
  | 'ACCESS_DENIED'
  /** There are files with the same filename. */
  | 'DUPLICATE_FILE_INPUT'
  /** Error. */
  | 'ERROR'
  /** The file is invalid. */
  | 'FILE_VALIDATION_ERROR'
  /** The input value should be less than or equal to the maximum value allowed. */
  | 'LESS_THAN_OR_EQUAL_TO'
  /** The record with the ID used as the input value couldn't be found. */
  | 'NOT_FOUND'
  /** There are theme files with conflicts. */
  | 'THEME_FILES_CONFLICT'
  /** This action is not available on your current plan. Please upgrade to access theme editing features. */
  | 'THEME_LIMITED_PLAN'
  /** Too many updates in a short period. Please try again later. */
  | 'THROTTLED'

/** The input fields for Theme attributes to update. */
export type OnlineStoreThemeInput = {
  /** The new name of the theme. */
  name?: InputMaybe<Scalars['String']['input']>
}

/** The role of the theme. */
export type ThemeRole =
  /**
   * The theme is archived if a merchant changes their plan and exceeds the maximum
   * number of themes allowed. Archived themes can be downloaded by merchant, but
   * can not be customized or published until the plan is upgraded.
   */
  | 'ARCHIVED'
  /**
   * The theme is installed as a trial from the Shopify Theme Store. It can be
   * customized using the theme editor, but access to the code editor and the
   * ability to publish the theme are restricted until it is purchased.
   */
  | 'DEMO'
  /** The theme is automatically created by the CLI for previewing purposes when in a development session. */
  | 'DEVELOPMENT'
  /**
   * The theme is locked if it is identified as unlicensed. Customization and
   * publishing are restricted until the merchant resolves the licensing issue.
   */
  | 'LOCKED'
  /** The currently published theme. There can only be one main theme at any time. */
  | 'MAIN'
  /** The currently published theme that is only accessible to a mobile client. */
  | 'MOBILE'
  /** The theme is currently not published. It can be transitioned to the main role if it is published by the merchant. */
  | 'UNPUBLISHED'

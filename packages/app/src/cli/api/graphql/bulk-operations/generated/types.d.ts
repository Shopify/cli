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

/** Error codes for failed bulk operations. */
export type BulkOperationErrorCode =
  /**
   * The provided operation `query` returned access denied due to missing
   * [access scopes](https://shopify.dev/api/usage/access-scopes).
   * Review the requested object permissions and execute the query as a normal non-bulk GraphQL request to see more details.
   */
  | 'ACCESS_DENIED'
  /**
   * The operation resulted in partial or incomplete data due to internal server errors during execution.
   * These errors might be intermittent, so you can try performing the same query again.
   */
  | 'INTERNAL_SERVER_ERROR'
  /**
   * The operation resulted in partial or incomplete data due to query timeouts during execution.
   * In some cases, timeouts can be avoided by modifying your `query` to select fewer fields.
   */
  | 'TIMEOUT'

/** The valid values for the status of a bulk operation. */
export type BulkOperationStatus =
  /** The bulk operation has been canceled. */
  | 'CANCELED'
  /**
   * Cancelation has been initiated on the bulk operation. There may be a short delay from when a cancelation
   * starts until the operation is actually canceled.
   */
  | 'CANCELING'
  /** The bulk operation has successfully completed. */
  | 'COMPLETED'
  /** The bulk operation has been created. */
  | 'CREATED'
  /** The bulk operation URL has expired. */
  | 'EXPIRED'
  /**
   * The bulk operation has failed. For information on why the operation failed, use
   * [BulkOperation.errorCode](https://shopify.dev/api/admin-graphql/latest/enums/bulkoperationerrorcode).
   */
  | 'FAILED'
  /** The bulk operation is runnning. */
  | 'RUNNING'

/** The valid values for the bulk operation's type. */
export type BulkOperationType =
  /** The bulk operation is a mutation. */
  | 'MUTATION'
  /** The bulk operation is a query. */
  | 'QUERY'

/** Possible error codes that can be returned by `BulkOperationUserError`. */
export type BulkOperationUserErrorCode =
  /** The input value is invalid. */
  | 'INVALID'
  /** Bulk operations limit reached. Please try again later. */
  | 'LIMIT_REACHED'
  /** A bulk operation is already in progress. */
  | 'OPERATION_IN_PROGRESS'

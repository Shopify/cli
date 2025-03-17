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
   * Represents an [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601)-encoded date and time string.
   * For example, 3:50 pm on September 7, 2019 in the time zone of UTC (Coordinated Universal Time) is
   * represented as `"2019-09-07T15:50:00Z`".
   */
  DateTime: {input: any; output: any}
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
  /**
   * Represents an [RFC 3986](https://datatracker.ietf.org/doc/html/rfc3986) and
   * [RFC 3987](https://datatracker.ietf.org/doc/html/rfc3987)-compliant URI string.
   *
   * For example, `"https://example.myshopify.com"` is a valid URL. It includes a scheme (`https`) and a host
   * (`example.myshopify.com`).
   */
  URL: {input: string; output: string}
}

/** The input fields used to create a new app version. */
export type AppVersionInput = {
  /** The manifest from which to create the app version. */
  source?: InputMaybe<Scalars['JSON']['input']>
  /** URL referencing the source from which to create the app version. */
  sourceUrl?: InputMaybe<Scalars['URL']['input']>
}

/** Possible error codes that can be returned by AppManagement. */
export type Code =
  /** Access denied. */
  | 'ACCESS_DENIED'
  /** An event error. */
  | 'EVENT'
  /** An internal error. */
  | 'INTERNAL'
  /** The request was invalid. */
  | 'INVALID'
  /** The requested resource was not found. */
  | 'NOT_FOUND'
  /** A plugin error. */
  | 'PLUGIN'
  /** An unknown error. */
  | 'UNKNOWN'

/** The input fields for app version metadata. */
export type VersionMetadataInput = {
  /** Message associated with this app version. */
  message?: InputMaybe<Scalars['String']['input']>
  /** Link to version control, if any. */
  sourceControlUrl?: InputMaybe<Scalars['URL']['input']>
  /** Version tag associated with this app version. */
  versionTag?: InputMaybe<Scalars['String']['input']>
}

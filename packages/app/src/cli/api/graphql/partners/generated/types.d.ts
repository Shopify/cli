/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/naming-convention, @typescript-eslint/no-explicit-any  */
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
   * An [ISO-8601](https://en.wikipedia.org/wiki/ISO_8601) encoded UTC date time
   * string. Example value: `"2019-07-03T20:47:55.123456Z"`.
   */
  DateTime: {input: any; output: any}
  /**
   * Deprecated: Supported extension types.
   *         This used to include a list of extension types, we mantain it to keep compatibility with the old schema
   */
  ExtensionType: {input: any; output: any}
  /** Represents untyped JSON */
  JSON: {input: JsonMapType | string; output: JsonMapType}
  /** A valid URL, transported as a string. */
  Url: {input: any; output: any}
  /** A valid webhook subscription endpoint string. */
  WebhookSubscriptionEndpoint: {input: any; output: any}
}

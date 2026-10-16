/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/naming-convention, @typescript-eslint/no-explicit-any, tsdoc/syntax, @typescript-eslint/no-duplicate-type-constituents, @typescript-eslint/no-redundant-type-constituents, @nx/enforce-module-boundaries  */
import {JsonMapType} from '@shopify/cli-kit/node/toml'
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /**
   * Represents an [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601)-encoded date and time string.
   * For example, 3:50 pm on September 7, 2019 in the time zone of UTC (Coordinated Universal Time) is
   * represented as `"2019-09-07T15:50:00Z`".
   */
  DateTime: { input: string; output: string; }
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
  JSON: { input: JsonMapType | string; output: JsonMapType; }
};

/** A log type. */
export type LogEventType =
  /** A GraphQL API request. */
  | 'GRAPHQL_REQUEST'
  /** A webhook delivery. */
  | 'WEBHOOK_DELIVERY';

/**
 * The fields logs can be filtered on. Each name matches a `shopify app logs` CLI
 * flag or the record field it filters. A filter on a field that a log type doesn't
 * have excludes that type's logs.
 */
export type LogFilterField =
  /** The GraphQL operation name. Applies to GraphQL requests. */
  | 'OPERATION_NAME'
  /** The GraphQL operation type, such as query or mutation. Applies to GraphQL requests. */
  | 'OPERATION_TYPE'
  /** The API request ID. Applies to GraphQL requests. */
  | 'REQUEST_ID'
  /** The result: SUCCESS or FAILURE, as in resultStatus. The CLI's --status flag. Applies to every log type. */
  | 'RESULT_STATUS'
  /** The shop's myshopify.com domain, as in shopMyshopifyDomain. The CLI's --store flag. Applies to every log type. */
  | 'SHOP_MYSHOPIFY_DOMAIN'
  /** The HTTP response status code, such as 500. Applies to webhook deliveries. */
  | 'STATUS_CODE'
  /** The webhook topic, such as orders/create. Applies to webhook deliveries. */
  | 'TOPIC';

/** The input fields for one logs filter. All filters are combined with AND. */
export type LogFilterInput = {
  /** The field to filter on. */
  field: LogFilterField;
  /** How to compare the field with the value. */
  operator: LogFilterOperator;
  /** The value to compare with, at most 1024 bytes. */
  value: Scalars['String']['input'];
};

/** How a filter compares a field with its value. */
export type LogFilterOperator =
  /** Matches logs whose field equals the value. */
  | 'EQUALS'
  /** Matches logs whose field doesn't equal the value, including logs with no value for the field. */
  | 'NOT_EQUALS';

/** The fields to sort logs by. */
export type LogSortKeys =
  /** Sort by timestamp. */
  | 'TIMESTAMP';

/** The input fields for a time range of up to 7 days within the last 30 days. */
export type TimestampRangeInput = {
  /** The start of the range, inclusive. */
  gte: Scalars['DateTime']['input'];
  /** The end of the range, exclusive. */
  lt: Scalars['DateTime']['input'];
};

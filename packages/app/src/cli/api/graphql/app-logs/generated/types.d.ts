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
  /**
   * Represents an [RFC 3986](https://datatracker.ietf.org/doc/html/rfc3986) and
   * [RFC 3987](https://datatracker.ietf.org/doc/html/rfc3987)-compliant URI string.
   *
   * For example, `"https://example.myshopify.com"` is a valid URL. It includes a scheme (`https`) and a host
   * (`example.myshopify.com`).
   */
  URL: { input: string; output: string; }
};

/**
 * The fields logs can be filtered on. logFilterFields lists which fields apply to
 * each log type. If a filter field applies to none of the originally requested log
 * types, the query returns BAD_REQUEST. Otherwise, each filter excludes log types
 * it does not apply to. Filters are combined with AND: if each filter individually
 * applies to a requested type but no type supports all filters, the query returns
 * an empty result.
 */
export type LogFilterField =
  /** The event handle the app sent, such as onboarding_completed, as in eventHandle. */
  | 'EVENT_HANDLE'
  /** The Function extension handle. */
  | 'FUNCTION_HANDLE'
  /** The HTTP method. */
  | 'METHOD'
  /** The GraphQL operation name. */
  | 'OPERATION_NAME'
  /** The GraphQL operation type, such as query or mutation. */
  | 'OPERATION_TYPE'
  /** The API request ID. */
  | 'REQUEST_ID'
  /** The request path. */
  | 'REQUEST_PATH'
  /** The result: SUCCESS or FAILURE, as in resultStatus. */
  | 'RESULT_STATUS'
  /** The shop's myshopify.com domain, as in shopMyshopifyDomain. */
  | 'SHOP_MYSHOPIFY_DOMAIN'
  /** The HTTP response status code, such as 500. */
  | 'STATUS_CODE'
  /**
   * The Sidekick event target, such as extensions/security_scan, the Function
   * execution target, or the UI extension target, such as
   * purchase.checkout.block.render.
   */
  | 'TARGET'
  /** The webhook topic, such as orders/create. */
  | 'TOPIC';

/** The input fields for one logs filter. All filters are combined with AND. */
export type LogFilterInput = {
  /** The field to filter on. */
  field: LogFilterField;
  /** How to compare the field with the value. */
  operator: LogFilterOperator;
  /**
   * For EQUALS and NOT_EQUALS, one string of at most 1024 bytes. For IN, a
   * JSON-encoded array of 1 to 50 non-blank strings, each at most 1024 bytes.
   * Duplicate values are matched once.
   */
  value: Scalars['String']['input'];
};

/** How a filter compares a field with its value. */
export type LogFilterOperator =
  /** Matches logs whose field equals the value. */
  | 'EQUALS'
  /** Matches logs whose field equals any string in the JSON-encoded value array. Logs with no value for the field do not match. */
  | 'IN'
  /** Matches logs whose field doesn't equal the value, including logs with no value for the field. */
  | 'NOT_EQUALS';

/** The fields to sort logs by. */
export type LogSortKeys =
  /** Sort by timestamp. */
  | 'TIMESTAMP';

/** A log type. */
export type LogType =
  /** The billing outcome of an event the app sent with the App Events API. */
  | 'APP_BILLING_EVENT'
  /** An event the app sent with the App Events API. */
  | 'APP_EVENT'
  /** A Shopify Function run. */
  | 'FUNCTION_RUN'
  /** A GraphQL API request. */
  | 'GRAPHQL_REQUEST'
  /** A REST API request. */
  | 'REST_REQUEST'
  /** A Sidekick event. */
  | 'SIDEKICK_EVENT'
  /** A UI extension error. */
  | 'UI_EXTENSION_ERROR'
  /** A webhook delivery. */
  | 'WEBHOOK';

/** The input fields for a time range of up to 7 days within the last 30 days. logQueryLimits returns these limits. */
export type TimestampRangeInput = {
  /** The start of the range, inclusive. */
  gte: Scalars['DateTime']['input'];
  /** The end of the range, exclusive. */
  lt: Scalars['DateTime']['input'];
};

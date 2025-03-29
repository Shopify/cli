/* eslint-disable @typescript-eslint/no-unused-vars, tsdoc/syntax, @typescript-eslint/consistent-type-definitions, @typescript-eslint/naming-convention */
import {graphql, type GraphQLResponseResolver, type RequestHandlerOptions} from 'msw'

type Maybe<T> = T | null
type InputMaybe<T> = Maybe<T>
type Exact<T extends {[key: string]: unknown}> = {[K in keyof T]: T[K]}
type MakeOptional<T, K extends keyof T> = Omit<T, K> & {[SubKey in K]?: Maybe<T[SubKey]>}
type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {[SubKey in K]: Maybe<T[SubKey]>}
type MakeEmpty<T extends {[key: string]: unknown}, K extends keyof T> = {[_ in K]?: never}
type Incremental<T> = T | {[P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never}
/** All built-in and custom scalars, mapped to their actual values */
type Scalars = {
  ID: {input: string; output: string}
  String: {input: string; output: string}
  Boolean: {input: boolean; output: boolean}
  Int: {input: number; output: number}
  Float: {input: number; output: number}
  /**
   * Represents an [RFC 3986](https://datatracker.ietf.org/doc/html/rfc3986) and
   * [RFC 3987](https://datatracker.ietf.org/doc/html/rfc3987)-compliant URI string.
   *
   * For example, `"https://example.myshopify.com"` is a valid URL. It includes a scheme (`https`) and a host
   * (`example.myshopify.com`).
   */
  URL: {input: unknown; output: unknown}
}

type SchemaDefinitionByApiTypeQueryVariables = Exact<{
  type: Scalars['String']['input']
  version: Scalars['String']['input']
}>

type SchemaDefinitionByApiTypeQuery = {api?: {schema?: {definition: string} | null} | null}

type SchemaDefinitionByTargetQueryVariables = Exact<{
  handle: Scalars['String']['input']
  version: Scalars['String']['input']
}>

type SchemaDefinitionByTargetQuery = {target?: {api: {schema?: {definition: string} | null}} | null}

const functions = graphql.link('https://functions.shopify-cli.mock/graphql')

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockSchemaDefinitionByApiTypeQueryFunctions(
 *   ({ query, variables }) => {
 *     const { type, version } = variables;
 *     return HttpResponse.json({
 *       data: { api }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockSchemaDefinitionByApiTypeQueryFunctions = (
  resolver: GraphQLResponseResolver<SchemaDefinitionByApiTypeQuery, SchemaDefinitionByApiTypeQueryVariables>,
  options?: RequestHandlerOptions,
) =>
  functions.query<SchemaDefinitionByApiTypeQuery, SchemaDefinitionByApiTypeQueryVariables>(
    'SchemaDefinitionByApiType',
    resolver,
    options,
  )

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockSchemaDefinitionByTargetQueryFunctions(
 *   ({ query, variables }) => {
 *     const { handle, version } = variables;
 *     return HttpResponse.json({
 *       data: { target }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockSchemaDefinitionByTargetQueryFunctions = (
  resolver: GraphQLResponseResolver<SchemaDefinitionByTargetQuery, SchemaDefinitionByTargetQueryVariables>,
  options?: RequestHandlerOptions,
) =>
  functions.query<SchemaDefinitionByTargetQuery, SchemaDefinitionByTargetQueryVariables>(
    'SchemaDefinitionByTarget',
    resolver,
    options,
  )

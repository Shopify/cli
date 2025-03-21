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
}

type AvailableTopicsQueryVariables = Exact<{
  apiVersion: Scalars['String']['input']
}>

type AvailableTopicsQuery = {availableTopics?: string[] | null}

type CliTestingMutationVariables = Exact<{
  address: Scalars['String']['input']
  apiKey?: InputMaybe<Scalars['String']['input']>
  apiVersion: Scalars['String']['input']
  deliveryMethod: Scalars['String']['input']
  sharedSecret: Scalars['String']['input']
  topic: Scalars['String']['input']
}>

type CliTestingMutation = {
  cliTesting?: {headers?: string | null; samplePayload?: string | null; success: boolean; errors: string[]} | null
}

type PublicApiVersionsQueryVariables = Exact<{[key: string]: never}>

type PublicApiVersionsQuery = {publicApiVersions: {handle: string}[]}

const webhooks = graphql.link('https://webhooks.shopify-cli.mock/graphql')

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockAvailableTopicsQueryWebhooks(
 *   ({ query, variables }) => {
 *     const { apiVersion } = variables;
 *     return HttpResponse.json({
 *       data: { availableTopics }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockAvailableTopicsQueryWebhooks = (
  resolver: GraphQLResponseResolver<AvailableTopicsQuery, AvailableTopicsQueryVariables>,
  options?: RequestHandlerOptions,
) => webhooks.query<AvailableTopicsQuery, AvailableTopicsQueryVariables>('availableTopics', resolver, options)

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockCliTestingMutationWebhooks(
 *   ({ query, variables }) => {
 *     const { address, apiKey, apiVersion, deliveryMethod, sharedSecret, topic } = variables;
 *     return HttpResponse.json({
 *       data: { cliTesting }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockCliTestingMutationWebhooks = (
  resolver: GraphQLResponseResolver<CliTestingMutation, CliTestingMutationVariables>,
  options?: RequestHandlerOptions,
) => webhooks.mutation<CliTestingMutation, CliTestingMutationVariables>('CliTesting', resolver, options)

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockPublicApiVersionsQueryWebhooks(
 *   ({ query, variables }) => {
 *     return HttpResponse.json({
 *       data: { publicApiVersions }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockPublicApiVersionsQueryWebhooks = (
  resolver: GraphQLResponseResolver<PublicApiVersionsQuery, PublicApiVersionsQueryVariables>,
  options?: RequestHandlerOptions,
) => webhooks.query<PublicApiVersionsQuery, PublicApiVersionsQueryVariables>('publicApiVersions', resolver, options)

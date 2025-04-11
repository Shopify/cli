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
   * An [ISO-8601](https://en.wikipedia.org/wiki/ISO_8601) encoded UTC date time
   * string. Example value: `"2019-07-03T20:47:55.123456Z"`.
   */
  DateTime: {input: unknown; output: unknown}
  /**
   * Deprecated: Supported extension types.
   *         This used to include a list of extension types, we mantain it to keep compatibility with the old schema
   */
  ExtensionType: {input: unknown; output: unknown}
  /** Represents untyped JSON */
  JSON: {input: unknown; output: unknown}
  /** A valid URL, transported as a string. */
  Url: {input: unknown; output: unknown}
  /** A valid webhook subscription endpoint string. */
  WebhookSubscriptionEndpoint: {input: unknown; output: unknown}
}

type AllOrgsQueryVariables = Exact<{[key: string]: never}>

type AllOrgsQuery = {organizations: {nodes?: ({id: string; businessName: string} | null)[] | null}}

type DevStoresByOrgQueryVariables = Exact<{
  id: Scalars['ID']['input']
}>

type DevStoresByOrgQuery = {
  organizations: {
    nodes?:
      | ({
          id: string
          stores: {
            nodes?:
              | ({
                  shopId?: string | null
                  link: unknown
                  shopDomain: string
                  shopName: string
                  transferDisabled: boolean
                  convertableToPartnerTest: boolean
                } | null)[]
              | null
          }
        } | null)[]
      | null
  }
}

type ExtensionUpdateDraftMutationVariables = Exact<{
  apiKey: Scalars['String']['input']
  registrationId: Scalars['ID']['input']
  config: Scalars['JSON']['input']
  context?: InputMaybe<Scalars['String']['input']>
  handle?: InputMaybe<Scalars['String']['input']>
}>

type ExtensionUpdateDraftMutation = {
  extensionUpdateDraft?: {userErrors?: {field?: string[] | null; message: string}[] | null} | null
}

const partners = graphql.link('https://partners.shopify-cli.mock/api/cli/graphql')

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockAllOrgsQueryPartners(
 *   ({ query, variables }) => {
 *     return HttpResponse.json({
 *       data: { organizations }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockAllOrgsQueryPartners = (
  resolver: GraphQLResponseResolver<AllOrgsQuery, AllOrgsQueryVariables>,
  options?: RequestHandlerOptions,
) => partners.query<AllOrgsQuery, AllOrgsQueryVariables>('AllOrgs', resolver, options)

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockDevStoresByOrgQueryPartners(
 *   ({ query, variables }) => {
 *     const { id } = variables;
 *     return HttpResponse.json({
 *       data: { organizations }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockDevStoresByOrgQueryPartners = (
  resolver: GraphQLResponseResolver<DevStoresByOrgQuery, DevStoresByOrgQueryVariables>,
  options?: RequestHandlerOptions,
) => partners.query<DevStoresByOrgQuery, DevStoresByOrgQueryVariables>('DevStoresByOrg', resolver, options)

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockExtensionUpdateDraftMutationPartners(
 *   ({ query, variables }) => {
 *     const { apiKey, registrationId, config, context, handle } = variables;
 *     return HttpResponse.json({
 *       data: { extensionUpdateDraft }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockExtensionUpdateDraftMutationPartners = (
  resolver: GraphQLResponseResolver<ExtensionUpdateDraftMutation, ExtensionUpdateDraftMutationVariables>,
  options?: RequestHandlerOptions,
) =>
  partners.mutation<ExtensionUpdateDraftMutation, ExtensionUpdateDraftMutationVariables>(
    'ExtensionUpdateDraft',
    resolver,
    options,
  )

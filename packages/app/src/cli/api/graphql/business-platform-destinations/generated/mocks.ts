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
  DestinationID: {input: unknown; output: unknown}
  DestinationPublicID: {input: unknown; output: unknown}
  GlobalID: {input: unknown; output: unknown}
  /** An ISO 8601-encoded datetime */
  ISO8601DateTime: {input: unknown; output: unknown}
  /** The ID for a Organization. */
  OrganizationID: {input: unknown; output: unknown}
}

type FindOrganizationsQueryVariables = Exact<{
  organizationId: Scalars['OrganizationID']['input']
}>

type FindOrganizationsQuery = {currentUserAccount?: {organization?: {id: string; name: string} | null} | null}

type ListOrganizationsQueryVariables = Exact<{[key: string]: never}>

type ListOrganizationsQuery = {
  currentUserAccount?: {uuid: string; organizations: {nodes: {id: string; name: string}[]}} | null
}

type UserInfoQueryVariables = Exact<{[key: string]: never}>

type UserInfoQuery = {currentUserAccount?: {uuid: string; email: string} | null}

const businessPlatformDestinations = graphql.link(
  'https://business-platform-destinations.shopify-cli.mock/destinations/api/2020-07/graphql',
)

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockFindOrganizationsQueryBusinessPlatformDestinations(
 *   ({ query, variables }) => {
 *     const { organizationId } = variables;
 *     return HttpResponse.json({
 *       data: { currentUserAccount }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockFindOrganizationsQueryBusinessPlatformDestinations = (
  resolver: GraphQLResponseResolver<FindOrganizationsQuery, FindOrganizationsQueryVariables>,
  options?: RequestHandlerOptions,
) =>
  businessPlatformDestinations.query<FindOrganizationsQuery, FindOrganizationsQueryVariables>(
    'FindOrganizations',
    resolver,
    options,
  )

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockListOrganizationsQueryBusinessPlatformDestinations(
 *   ({ query, variables }) => {
 *     return HttpResponse.json({
 *       data: { currentUserAccount }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockListOrganizationsQueryBusinessPlatformDestinations = (
  resolver: GraphQLResponseResolver<ListOrganizationsQuery, ListOrganizationsQueryVariables>,
  options?: RequestHandlerOptions,
) =>
  businessPlatformDestinations.query<ListOrganizationsQuery, ListOrganizationsQueryVariables>(
    'ListOrganizations',
    resolver,
    options,
  )

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockUserInfoQueryBusinessPlatformDestinations(
 *   ({ query, variables }) => {
 *     return HttpResponse.json({
 *       data: { currentUserAccount }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockUserInfoQueryBusinessPlatformDestinations = (
  resolver: GraphQLResponseResolver<UserInfoQuery, UserInfoQueryVariables>,
  options?: RequestHandlerOptions,
) => businessPlatformDestinations.query<UserInfoQuery, UserInfoQueryVariables>('UserInfo', resolver, options)

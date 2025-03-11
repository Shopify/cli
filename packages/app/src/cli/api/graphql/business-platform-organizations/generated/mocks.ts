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
  AccessRoleAssignee: {input: unknown; output: unknown}
  /** The ID for a AccessRole. */
  AccessRoleID: {input: unknown; output: unknown}
  AccessRoleRecordId: {input: unknown; output: unknown}
  /** The ID for a ActionAudit. */
  ActionAuditID: {input: unknown; output: unknown}
  /** The ID for a DocumentAttachment. */
  DocumentAttachmentID: {input: unknown; output: unknown}
  /** The ID for a EntitySupportingDocument. */
  EntitySupportingDocumentID: {input: unknown; output: unknown}
  GlobalID: {input: unknown; output: unknown}
  /** The ID for a GovernmentIdentifier. */
  GovernmentIdentifierID: {input: unknown; output: unknown}
  /** The ID for a Group. */
  GroupID: {input: unknown; output: unknown}
  /** An ISO 8601-encoded date */
  ISO8601Date: {input: unknown; output: unknown}
  /** An ISO 8601-encoded datetime */
  ISO8601DateTime: {input: unknown; output: unknown}
  /** The ID for a LegalEntity. */
  LegalEntityID: {input: unknown; output: unknown}
  /** The ID for a OrganizationDomain. */
  OrganizationDomainID: {input: unknown; output: unknown}
  /** The ID for a Organization. */
  OrganizationID: {input: unknown; output: unknown}
  /** The ID for a OrganizationUser. */
  OrganizationUserID: {input: unknown; output: unknown}
  /** The ID for a Person. */
  PersonID: {input: unknown; output: unknown}
  /** The ID for a Principal. */
  PrincipalID: {input: unknown; output: unknown}
  /** The ID for a Property. */
  PropertyID: {input: unknown; output: unknown}
  PropertyId: {input: unknown; output: unknown}
  PropertyPublicID: {input: unknown; output: unknown}
  /** The ID for a PropertyTransferRequest. */
  PropertyTransferRequestID: {input: unknown; output: unknown}
  /** The ID for a Role. */
  RoleID: {input: unknown; output: unknown}
  /** The ID for a ShopifyShop. */
  ShopifyShopID: {input: unknown; output: unknown}
  /** The ID for a StoreAdditionRequest. */
  StoreAdditionRequestID: {input: unknown; output: unknown}
  SupportedEntityId: {input: unknown; output: unknown}
  /** The ID for a SupportingDocument. */
  SupportingDocumentID: {input: unknown; output: unknown}
  /** An RFC 3986 and RFC 3987 compliant URI string. */
  URL: {input: unknown; output: unknown}
}

type Store = 'APP_DEVELOPMENT' | 'DEVELOPMENT' | 'DEVELOPMENT_SUPERSET' | 'PRODUCTION'

type FetchDevStoreByDomainQueryVariables = Exact<{
  domain?: InputMaybe<Scalars['String']['input']>
}>

type FetchDevStoreByDomainQuery = {
  organization?: {
    id: string
    name: string
    accessibleShops?: {
      edges: {
        node: {
          id: string
          externalId?: string | null
          name: string
          storeType?: Store | null
          primaryDomain?: string | null
          shortName?: string | null
        }
      }[]
    } | null
  } | null
}

type ListAppDevStoresQueryVariables = Exact<{
  searchTerm?: InputMaybe<Scalars['String']['input']>
}>

type ListAppDevStoresQuery = {
  organization?: {
    id: string
    name: string
    accessibleShops?: {
      edges: {
        node: {
          id: string
          externalId?: string | null
          name: string
          storeType?: Store | null
          primaryDomain?: string | null
          shortName?: string | null
        }
      }[]
      pageInfo: {hasNextPage: boolean}
    } | null
  } | null
}

const businessPlatformOrganizations = graphql.link('https://business-platform-organizations.shopify-cli.mock/graphql')

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockFetchDevStoreByDomainQueryBusinessPlatformOrganizations(
 *   ({ query, variables }) => {
 *     const { domain } = variables;
 *     return HttpResponse.json({
 *       data: { organization }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockFetchDevStoreByDomainQueryBusinessPlatformOrganizations = (
  resolver: GraphQLResponseResolver<FetchDevStoreByDomainQuery, FetchDevStoreByDomainQueryVariables>,
  options?: RequestHandlerOptions,
) =>
  businessPlatformOrganizations.query<FetchDevStoreByDomainQuery, FetchDevStoreByDomainQueryVariables>(
    'FetchDevStoreByDomain',
    resolver,
    options,
  )

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockListAppDevStoresQueryBusinessPlatformOrganizations(
 *   ({ query, variables }) => {
 *     const { searchTerm } = variables;
 *     return HttpResponse.json({
 *       data: { organization }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockListAppDevStoresQueryBusinessPlatformOrganizations = (
  resolver: GraphQLResponseResolver<ListAppDevStoresQuery, ListAppDevStoresQueryVariables>,
  options?: RequestHandlerOptions,
) =>
  businessPlatformOrganizations.query<ListAppDevStoresQuery, ListAppDevStoresQueryVariables>(
    'ListAppDevStores',
    resolver,
    options,
  )

/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/naming-convention, @typescript-eslint/no-explicit-any  */
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
  AccessRoleAssignee: {input: any; output: any}
  /** The ID for a AccessRole. */
  AccessRoleID: {input: any; output: any}
  AccessRoleRecordId: {input: any; output: any}
  /** The ID for a ActionAudit. */
  ActionAuditID: {input: any; output: any}
  /** The ID for a DocumentAttachment. */
  DocumentAttachmentID: {input: any; output: any}
  /** The ID for a EntitySupportingDocument. */
  EntitySupportingDocumentID: {input: any; output: any}
  GlobalID: {input: string; output: string}
  /** The ID for a GovernmentIdentifier. */
  GovernmentIdentifierID: {input: any; output: any}
  /** The ID for a Group. */
  GroupID: {input: any; output: any}
  /** An ISO 8601-encoded date */
  ISO8601Date: {input: any; output: any}
  /** An ISO 8601-encoded datetime */
  ISO8601DateTime: {input: any; output: any}
  /** The ID for a LegalEntity. */
  LegalEntityID: {input: any; output: any}
  /** The ID for a OrganizationDomain. */
  OrganizationDomainID: {input: any; output: any}
  /** The ID for a Organization. */
  OrganizationID: {input: any; output: any}
  /** The ID for a OrganizationUser. */
  OrganizationUserID: {input: any; output: any}
  /** The ID for a Person. */
  PersonID: {input: any; output: any}
  /** The ID for a Principal. */
  PrincipalID: {input: any; output: any}
  /** The ID for a Property. */
  PropertyID: {input: any; output: any}
  PropertyId: {input: string; output: string}
  PropertyPublicID: {input: string; output: string}
  /** The ID for a PropertyTransferRequest. */
  PropertyTransferRequestID: {input: any; output: any}
  /** The ID for a Role. */
  RoleID: {input: any; output: any}
  /** The ID for a ShopifyShop. */
  ShopifyShopID: {input: any; output: any}
  /** The ID for a StoreAdditionRequest. */
  StoreAdditionRequestID: {input: any; output: any}
  /** An RFC 3986 and RFC 3987 compliant URI string. */
  URL: {input: string; output: string}
}

export type Store = 'APP_DEVELOPMENT' | 'DEVELOPMENT' | 'DEVELOPMENT_SUPERSET' | 'PRODUCTION'

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
  AccessRoleAssignee: { input: any; output: any; }
  /** The ID for a AccessRole. */
  AccessRoleID: { input: any; output: any; }
  AccessRoleRecordId: { input: any; output: any; }
  /** The ID for a ActionAudit. */
  ActionAuditID: { input: any; output: any; }
  /** The ID for a Address. */
  AddressID: { input: any; output: any; }
  /** The ID for a BulkDataOperation. */
  BulkDataOperationID: { input: any; output: any; }
  /** The ID for a BusinessUser. */
  BusinessUserID: { input: any; output: any; }
  /** The ID for a BusinessUsersImport. */
  BusinessUsersImportID: { input: any; output: any; }
  /** A signed decimal number, which supports arbitrary precision and is serialized as a string. */
  Decimal: { input: any; output: any; }
  /** The ID for a DocumentAttachment. */
  DocumentAttachmentID: { input: any; output: any; }
  /** The ID for a EntitySupportingDocument. */
  EntitySupportingDocumentID: { input: any; output: any; }
  GlobalID: { input: string; output: string; }
  /** The ID for a GovernmentIdentifier. */
  GovernmentIdentifierID: { input: any; output: any; }
  /** The ID for a Group. */
  GroupID: { input: any; output: any; }
  /** An ISO 8601-encoded date */
  ISO8601Date: { input: any; output: any; }
  /** An ISO 8601-encoded datetime */
  ISO8601DateTime: { input: any; output: any; }
  /** Represents untyped JSON */
  JSON: { input: JsonMapType | string; output: JsonMapType; }
  /** The ID for a LegalEntity. */
  LegalEntityID: { input: any; output: any; }
  /** The ID for a OrganizationDomain. */
  OrganizationDomainID: { input: any; output: any; }
  /** The ID for a Organization. */
  OrganizationID: { input: any; output: any; }
  /** The ID for a OrganizationUser. */
  OrganizationUserID: { input: any; output: any; }
  /** The ID for a PersonAlias. */
  PersonAliasID: { input: any; output: any; }
  /** The ID for a Person. */
  PersonID: { input: any; output: any; }
  /** The ID for a Principal. */
  PrincipalID: { input: any; output: any; }
  /** The ID for a Property. */
  PropertyID: { input: any; output: any; }
  PropertyId: { input: string; output: string; }
  PropertyPublicID: { input: string; output: string; }
  /** The ID for a PropertyTransferRequest. */
  PropertyTransferRequestID: { input: any; output: any; }
  /** The ID for a Role. */
  RoleID: { input: any; output: any; }
  /** The ID for a Shop. */
  ShopID: { input: any; output: any; }
  /** The ID for a ShopifyShop. */
  ShopifyShopID: { input: any; output: any; }
  /** The ID for a StoreAdditionRequest. */
  StoreAdditionRequestID: { input: any; output: any; }
  SupportedEntityId: { input: any; output: any; }
  /** The ID for a SupportingDocument. */
  SupportingDocumentID: { input: any; output: any; }
  /** An RFC 3986 and RFC 3987 compliant URI string. */
  URL: { input: string; output: string; }
};

/** Operators for filter queries. */
export type Operator =
  /** Between operator. */
  | 'BETWEEN'
  /** Equals operator. */
  | 'EQUALS'
  /**
   * In operator. Accepts a comma-separated string of values (e.g.
   * "value1,value2,value3"). Not supported for all filter fields.
   */
  | 'IN';

export type OrganizationUserProvisionShopAccessInput = {
  /** The shop to provision the requester on. */
  shopifyShopId: Scalars['PropertyPublicID']['input'];
};

/** Field options for filtering shop queries. */
export type ShopFilterField =
  /**
   * The phase of the client transfer process. Requires
   * `store_type=client_transfer`. Values: `in_development`, `pending`, `completed`.
   */
  | 'CLIENT_TRANSFER_PHASE'
  /**
   * The status of the collaborator relationship. Requires
   * `store_type=collaborator`. Values: `active`, `access_pending`, `expired`.
   */
  | 'COLLABORATOR_RELATIONSHIP_STATUS'
  /** The GID of the counterpart organization. Requires `store_type=client_transfer` or `store_type=collaborator`. */
  | 'COUNTERPART_ORGANIZATION_ID'
  /** The GID of the owning organization of the shop. */
  | 'OWNER_ORGANIZATION_ID'
  /**
   * The plan of the shop. Values: `basic`, `grow`, `plus`, `frozen`, `advanced`,
   * `inactive`, `cancelled`, `client_transfer`, `plus_client_transfer`,
   * `development_legacy`, `custom`, `fraudulent`, `staff`, `trial`,
   * `plus_development`, `retail`, `shop_pay_commerce_components`, `non_profit`.
   * With the `In` operator, use raw plan names (e.g. "professional,shopify_plus").
   */
  | 'SHOP_PLAN'
  /** The active/inactive status of the shop. Values: `active`, `inactive`. */
  | 'STORE_STATUS'
  /**
   * The type of the shop. Does not support the `In` operator. Values:
   * `development`, `production`, `app_development`, `development_superset`,
   * `client_transfer`, `collaborator`.
   */
  | 'STORE_TYPE';

/**
 * Represents a single filter option for shop queries. When using the `In`
 * operator, pass a comma-separated string of values (e.g. "value1,value2").
 * Maximum 20 values.
 */
export type ShopFilterInput = {
  field: ShopFilterField;
  operator: Operator;
  value: Scalars['String']['input'];
};

export type Store =
  | 'APP_DEVELOPMENT'
  | 'CLIENT_TRANSFER'
  | 'COLLABORATOR'
  | 'DEVELOPMENT'
  | 'DEVELOPMENT_SUPERSET'
  | 'PRODUCTION';

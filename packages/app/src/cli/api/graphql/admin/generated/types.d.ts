/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/naming-convention, @typescript-eslint/no-explicit-any, tsdoc/syntax  */
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
   * An Amazon Web Services Amazon Resource Name (ARN), including the Region and account ID.
   * For more information, refer to [Amazon Resource Names](https://docs.aws.amazon.com/general/latest/gr/aws-arns-and-namespaces.html).
   */
  ARN: {input: any; output: any}
  /**
   * Represents non-fractional signed whole numeric values. Since the value may
   * exceed the size of a 32-bit integer, it's encoded as a string.
   */
  BigInt: {input: any; output: any}
  /**
   * A string containing a hexadecimal representation of a color.
   *
   * For example, "#6A8D48".
   */
  Color: {input: any; output: any}
  /**
   * Represents an [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601)-encoded date string.
   * For example, September 7, 2019 is represented as `"2019-07-16"`.
   */
  Date: {input: any; output: any}
  /**
   * Represents an [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601)-encoded date and time string.
   * For example, 3:50 pm on September 7, 2019 in the time zone of UTC (Coordinated Universal Time) is
   * represented as `"2019-09-07T15:50:00Z`".
   */
  DateTime: {input: any; output: any}
  /**
   * A signed decimal number, which supports arbitrary precision and is serialized as a string.
   *
   * Example values: `"29.99"`, `"29.999"`.
   */
  Decimal: {input: any; output: any}
  /**
   * A string containing a strict subset of HTML code. Non-allowed tags will be stripped out.
   * Allowed tags:
   * * `a` (allowed attributes: `href`, `target`)
   * * `b`
   * * `br`
   * * `em`
   * * `i`
   * * `strong`
   * * `u`
   * Use [HTML](https://shopify.dev/api/admin-graphql/latest/scalars/HTML) instead if you need to
   * include other HTML tags.
   *
   * Example value: `"Your current domain is <strong>example.myshopify.com</strong>."`
   */
  FormattedString: {input: any; output: any}
  /**
   * A string containing HTML code. Refer to the [HTML spec](https://html.spec.whatwg.org/#elements-3) for a
   * complete list of HTML elements.
   *
   * Example value: `"<p>Grey cotton knit sweater.</p>"`
   */
  HTML: {input: any; output: any}
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
  JSON: {input: any; output: any}
  /** A monetary value string without a currency symbol or code. Example value: `"100.57"`. */
  Money: {input: any; output: any}
  /**
   * Represents a unique identifier in the Storefront API. A `StorefrontID` value can
   * be used wherever an ID is expected in the Storefront API.
   *
   * Example value: `"Z2lkOi8vc2hvcGlmeS9Qcm9kdWN0LzEwMDc5Nzg1MTAw"`.
   */
  StorefrontID: {input: any; output: any}
  /**
   * Represents an [RFC 3986](https://datatracker.ietf.org/doc/html/rfc3986) and
   * [RFC 3987](https://datatracker.ietf.org/doc/html/rfc3987)-compliant URI string.
   *
   * For example, `"https://example.myshopify.com"` is a valid URL. It includes a scheme (`https`) and a host
   * (`example.myshopify.com`).
   */
  URL: {input: any; output: any}
  /**
   * An unsigned 64-bit integer. Represents whole numeric values between 0 and 2^64 - 1 encoded as a string of base-10 digits.
   *
   * Example value: `"50"`.
   */
  UnsignedInt64: {input: any; output: any}
  /**
   * Time between UTC time and a location's observed time, in the format `"+HH:MM"` or `"-HH:MM"`.
   *
   * Example value: `"-07:00"`.
   */
  UtcOffset: {input: any; output: any}
}

/**
 * The supported topics for webhook subscriptions. You can use webhook subscriptions to receive
 * notifications about particular events in a shop.
 *
 * You create mandatory webhooks either via the
 * [Partner Dashboard](https://shopify.dev/apps/webhooks/configuration/mandatory-webhooks#subscribe-to-privacy-webhooks)
 * or by updating the [app configuration file](https://shopify.dev/apps/tools/cli/configuration#app-configuration-file-example).
 *
 * > Tip:
 * >To configure your subscription using the app configuration file, refer to the
 * [full list of topic
 * names](https://shopify.dev/docs/api/webhooks?reference=graphql).
 */
export type WebhookSubscriptionTopic =
  /** The webhook topic for `app_purchases_one_time/update` events. Occurs whenever a one-time app charge is updated. */
  | 'APP_PURCHASES_ONE_TIME_UPDATE'
  /**
   * The webhook topic for `app/scopes_update` events. Occurs whenever the access
   * scopes of any installation are modified. Allows apps to keep track of the
   * granted access scopes of their installations.
   */
  | 'APP_SCOPES_UPDATE'
  /**
   * The webhook topic for `app_subscriptions/approaching_capped_amount` events.
   * Occurs when the balance used on an app subscription crosses 90% of the capped amount.
   */
  | 'APP_SUBSCRIPTIONS_APPROACHING_CAPPED_AMOUNT'
  /** The webhook topic for `app_subscriptions/update` events. Occurs whenever an app subscription is updated. */
  | 'APP_SUBSCRIPTIONS_UPDATE'
  /** The webhook topic for `app/uninstalled` events. Occurs whenever a shop has uninstalled the app. */
  | 'APP_UNINSTALLED'
  /**
   * The webhook topic for `attributed_sessions/first` events. Occurs whenever an
   * order with a "first" attributed session is attributed. Requires the
   * `read_marketing_events` scope.
   */
  | 'ATTRIBUTED_SESSIONS_FIRST'
  /**
   * The webhook topic for `attributed_sessions/last` events. Occurs whenever an
   * order with a "last" attributed session is attributed. Requires the
   * `read_marketing_events` scope.
   */
  | 'ATTRIBUTED_SESSIONS_LAST'
  /**
   * The webhook topic for `audit_events/admin_api_activity` events. Triggers for
   * each auditable Admin API request. This topic is limited to one active
   * subscription per Plus store and requires the use of Google Cloud Pub/Sub or
   * AWS EventBridge. Requires the `read_audit_events` scope.
   */
  | 'AUDIT_EVENTS_ADMIN_API_ACTIVITY'
  /** The webhook topic for `bulk_operations/finish` events. Notifies when a Bulk Operation finishes. */
  | 'BULK_OPERATIONS_FINISH'
  /**
   * The webhook topic for `carts/create` events. Occurs when a cart is created in
   * the online store. Other types of carts aren't supported. For example, the
   * webhook doesn't support carts that are created in a custom storefront.
   * Requires the `read_orders` scope.
   */
  | 'CARTS_CREATE'
  /**
   * The webhook topic for `carts/update` events. Occurs when a cart is updated in
   * the online store. Other types of carts aren't supported. For example, the
   * webhook doesn't support carts that are updated in a custom storefront.
   * Requires the `read_orders` scope.
   */
  | 'CARTS_UPDATE'
  /**
   * The webhook topic for `channels/delete` events. Occurs whenever a channel is
   * deleted. Requires the `read_publications` scope.
   */
  | 'CHANNELS_DELETE'
  /** The webhook topic for `checkouts/create` events. Occurs whenever a checkout is created. Requires the `read_orders` scope. */
  | 'CHECKOUTS_CREATE'
  /** The webhook topic for `checkouts/delete` events. Occurs whenever a checkout is deleted. Requires the `read_orders` scope. */
  | 'CHECKOUTS_DELETE'
  /** The webhook topic for `checkouts/paid` events. Occurs whenever a checkout is paid. Requires the `read_orders` scope. */
  | 'CHECKOUTS_PAID'
  /** The webhook topic for `checkouts/update` events. Occurs whenever a checkout is updated. Requires the `read_orders` scope. */
  | 'CHECKOUTS_UPDATE'
  /**
   * The webhook topic for `collections/create` events. Occurs whenever a
   * collection is created. Requires the `read_products` scope.
   */
  | 'COLLECTIONS_CREATE'
  /**
   * The webhook topic for `collections/delete` events. Occurs whenever a
   * collection is deleted. Requires the `read_products` scope.
   */
  | 'COLLECTIONS_DELETE'
  /**
   * The webhook topic for `collections/update` events. Occurs whenever a
   * collection is updated, including whenever products are added or removed from
   * the collection. Occurs once if multiple products are added or removed from a
   * collection at the same time. Requires the `read_products` scope.
   */
  | 'COLLECTIONS_UPDATE'
  /**
   * The webhook topic for `collection_listings/add` events. Occurs whenever a
   * collection listing is added. Requires the `read_product_listings` scope.
   */
  | 'COLLECTION_LISTINGS_ADD'
  /**
   * The webhook topic for `collection_listings/remove` events. Occurs whenever a
   * collection listing is removed. Requires the `read_product_listings` scope.
   */
  | 'COLLECTION_LISTINGS_REMOVE'
  /**
   * The webhook topic for `collection_listings/update` events. Occurs whenever a
   * collection listing is updated. Requires the `read_product_listings` scope.
   */
  | 'COLLECTION_LISTINGS_UPDATE'
  /**
   * The webhook topic for `collection_publications/create` events. Occurs whenever
   * a collection publication listing is created. Requires the `read_publications` scope.
   */
  | 'COLLECTION_PUBLICATIONS_CREATE'
  /**
   * The webhook topic for `collection_publications/delete` events. Occurs whenever
   * a collection publication listing is deleted. Requires the `read_publications` scope.
   */
  | 'COLLECTION_PUBLICATIONS_DELETE'
  /**
   * The webhook topic for `collection_publications/update` events. Occurs whenever
   * a collection publication listing is updated. Requires the `read_publications` scope.
   */
  | 'COLLECTION_PUBLICATIONS_UPDATE'
  /**
   * The webhook topic for `companies/create` events. Occurs whenever a company is
   * created. Requires at least one of the following scopes: read_customers,
   * read_companies.
   */
  | 'COMPANIES_CREATE'
  /**
   * The webhook topic for `companies/delete` events. Occurs whenever a company is
   * deleted. Requires at least one of the following scopes: read_customers,
   * read_companies.
   */
  | 'COMPANIES_DELETE'
  /**
   * The webhook topic for `companies/update` events. Occurs whenever a company is
   * updated. Requires at least one of the following scopes: read_customers,
   * read_companies.
   */
  | 'COMPANIES_UPDATE'
  /**
   * The webhook topic for `company_contacts/create` events. Occurs whenever a
   * company contact is created. Requires at least one of the following scopes:
   * read_customers, read_companies.
   */
  | 'COMPANY_CONTACTS_CREATE'
  /**
   * The webhook topic for `company_contacts/delete` events. Occurs whenever a
   * company contact is deleted. Requires at least one of the following scopes:
   * read_customers, read_companies.
   */
  | 'COMPANY_CONTACTS_DELETE'
  /**
   * The webhook topic for `company_contacts/update` events. Occurs whenever a
   * company contact is updated. Requires at least one of the following scopes:
   * read_customers, read_companies.
   */
  | 'COMPANY_CONTACTS_UPDATE'
  /**
   * The webhook topic for `company_contact_roles/assign` events. Occurs whenever a
   * role is assigned to a contact at a location. Requires at least one of the
   * following scopes: read_customers, read_companies.
   */
  | 'COMPANY_CONTACT_ROLES_ASSIGN'
  /**
   * The webhook topic for `company_contact_roles/revoke` events. Occurs whenever a
   * role is revoked from a contact at a location. Requires at least one of the
   * following scopes: read_customers, read_companies.
   */
  | 'COMPANY_CONTACT_ROLES_REVOKE'
  /**
   * The webhook topic for `company_locations/create` events. Occurs whenever a
   * company location is created. Requires at least one of the following scopes:
   * read_customers, read_companies.
   */
  | 'COMPANY_LOCATIONS_CREATE'
  /**
   * The webhook topic for `company_locations/delete` events. Occurs whenever a
   * company location is deleted. Requires at least one of the following scopes:
   * read_customers, read_companies.
   */
  | 'COMPANY_LOCATIONS_DELETE'
  /**
   * The webhook topic for `company_locations/update` events. Occurs whenever a
   * company location is updated. Requires at least one of the following scopes:
   * read_customers, read_companies.
   */
  | 'COMPANY_LOCATIONS_UPDATE'
  /**
   * The webhook topic for `customers/create` events. Occurs whenever a customer is
   * created. Requires the `read_customers` scope.
   */
  | 'CUSTOMERS_CREATE'
  /**
   * The webhook topic for `customers/delete` events. Occurs whenever a customer is
   * deleted. Requires the `read_customers` scope.
   */
  | 'CUSTOMERS_DELETE'
  /**
   * The webhook topic for `customers/disable` events. Occurs whenever a customer
   * account is disabled. Requires the `read_customers` scope.
   */
  | 'CUSTOMERS_DISABLE'
  /**
   * The webhook topic for `customers_email_marketing_consent/update` events.
   * Occurs whenever a customer's email marketing consent is updated. Requires the
   * `read_customers` scope.
   */
  | 'CUSTOMERS_EMAIL_MARKETING_CONSENT_UPDATE'
  /**
   * The webhook topic for `customers/enable` events. Occurs whenever a customer
   * account is enabled. Requires the `read_customers` scope.
   */
  | 'CUSTOMERS_ENABLE'
  /**
   * The webhook topic for `customers_marketing_consent/update` events. Occurs
   * whenever a customer's SMS marketing consent is updated. Requires the
   * `read_customers` scope.
   */
  | 'CUSTOMERS_MARKETING_CONSENT_UPDATE'
  /**
   * The webhook topic for `customers/merge` events. Triggers when two customers
   * are merged Requires the `read_customer_merge` scope.
   */
  | 'CUSTOMERS_MERGE'
  /**
   * The webhook topic for `customers/update` events. Occurs whenever a customer is
   * updated. Requires the `read_customers` scope.
   */
  | 'CUSTOMERS_UPDATE'
  /** The webhook topic for `customer_account_settings/update` events. Triggers when merchants change customer account setting. */
  | 'CUSTOMER_ACCOUNT_SETTINGS_UPDATE'
  /**
   * The webhook topic for `customer_groups/create` events. Occurs whenever a
   * customer saved search is created. Requires the `read_customers` scope.
   */
  | 'CUSTOMER_GROUPS_CREATE'
  /**
   * The webhook topic for `customer_groups/delete` events. Occurs whenever a
   * customer saved search is deleted. Requires the `read_customers` scope.
   */
  | 'CUSTOMER_GROUPS_DELETE'
  /**
   * The webhook topic for `customer_groups/update` events. Occurs whenever a
   * customer saved search is updated. Requires the `read_customers` scope.
   */
  | 'CUSTOMER_GROUPS_UPDATE'
  /**
   * The webhook topic for `customer_payment_methods/create` events. Occurs
   * whenever a customer payment method is created. Requires the
   * `read_customer_payment_methods` scope.
   */
  | 'CUSTOMER_PAYMENT_METHODS_CREATE'
  /**
   * The webhook topic for `customer_payment_methods/revoke` events. Occurs
   * whenever a customer payment method is revoked. Requires the
   * `read_customer_payment_methods` scope.
   */
  | 'CUSTOMER_PAYMENT_METHODS_REVOKE'
  /**
   * The webhook topic for `customer_payment_methods/update` events. Occurs
   * whenever a customer payment method is updated. Requires the
   * `read_customer_payment_methods` scope.
   */
  | 'CUSTOMER_PAYMENT_METHODS_UPDATE'
  /**
   * The webhook topic for `customer.tags_added` events. Triggers when tags are
   * added to a customer. Requires the `read_customers` scope.
   */
  | 'CUSTOMER_TAGS_ADDED'
  /**
   * The webhook topic for `customer.tags_removed` events. Triggers when tags are
   * removed from a customer. Requires the `read_customers` scope.
   */
  | 'CUSTOMER_TAGS_REMOVED'
  /**
   * The webhook topic for `discounts/create` events. Occurs whenever a discount is
   * created. Requires the `read_discounts` scope.
   */
  | 'DISCOUNTS_CREATE'
  /**
   * The webhook topic for `discounts/delete` events. Occurs whenever a discount is
   * deleted. Requires the `read_discounts` scope.
   */
  | 'DISCOUNTS_DELETE'
  /**
   * The webhook topic for `discounts/redeemcode_added` events. Occurs whenever a
   * redeem code is added to a code discount. Requires the `read_discounts` scope.
   */
  | 'DISCOUNTS_REDEEMCODE_ADDED'
  /**
   * The webhook topic for `discounts/redeemcode_removed` events. Occurs whenever a
   * redeem code on a code discount is deleted. Requires the `read_discounts` scope.
   */
  | 'DISCOUNTS_REDEEMCODE_REMOVED'
  /**
   * The webhook topic for `discounts/update` events. Occurs whenever a discount is
   * updated. Requires the `read_discounts` scope.
   */
  | 'DISCOUNTS_UPDATE'
  /**
   * The webhook topic for `disputes/create` events. Occurs whenever a dispute is
   * created. Requires the `read_shopify_payments_disputes` scope.
   */
  | 'DISPUTES_CREATE'
  /**
   * The webhook topic for `disputes/update` events. Occurs whenever a dispute is
   * updated. Requires the `read_shopify_payments_disputes` scope.
   */
  | 'DISPUTES_UPDATE'
  /** The webhook topic for `domains/create` events. Occurs whenever a domain is created. */
  | 'DOMAINS_CREATE'
  /** The webhook topic for `domains/destroy` events. Occurs whenever a domain is destroyed. */
  | 'DOMAINS_DESTROY'
  /** The webhook topic for `domains/update` events. Occurs whenever a domain is updated. */
  | 'DOMAINS_UPDATE'
  /**
   * The webhook topic for `draft_orders/create` events. Occurs whenever a draft
   * order is created. Requires the `read_draft_orders` scope.
   */
  | 'DRAFT_ORDERS_CREATE'
  /**
   * The webhook topic for `draft_orders/delete` events. Occurs whenever a draft
   * order is deleted. Requires the `read_draft_orders` scope.
   */
  | 'DRAFT_ORDERS_DELETE'
  /**
   * The webhook topic for `draft_orders/update` events. Occurs whenever a draft
   * order is updated. Requires the `read_draft_orders` scope.
   */
  | 'DRAFT_ORDERS_UPDATE'
  /**
   * The webhook topic for `finance_app_staff_member/delete` events. Triggers when
   * a staff with access to all or some finance app has been removed. Requires the
   * `read_financial_kyc_information` scope.
   */
  | 'FINANCE_APP_STAFF_MEMBER_DELETE'
  /**
   * The webhook topic for `finance_app_staff_member/grant` events. Triggers when a
   * staff is granted access to all or some finance app. Requires the
   * `read_financial_kyc_information` scope.
   */
  | 'FINANCE_APP_STAFF_MEMBER_GRANT'
  /**
   * The webhook topic for `finance_app_staff_member/revoke` events. Triggers when
   * a staff's access to all or some finance app has been revoked. Requires the
   * `read_financial_kyc_information` scope.
   */
  | 'FINANCE_APP_STAFF_MEMBER_REVOKE'
  /**
   * The webhook topic for `finance_app_staff_member/update` events. Triggers when
   * a staff's information has been updated. Requires the
   * `read_financial_kyc_information` scope.
   */
  | 'FINANCE_APP_STAFF_MEMBER_UPDATE'
  /**
   * The webhook topic for `finance_kyc_information/update` events. Occurs whenever
   * shop's finance KYC information was updated Requires the
   * `read_financial_kyc_information` scope.
   */
  | 'FINANCE_KYC_INFORMATION_UPDATE'
  /**
   * The webhook topic for `fulfillments/create` events. Occurs whenever a
   * fulfillment is created. Requires at least one of the following scopes:
   * read_fulfillments, read_marketplace_orders.
   */
  | 'FULFILLMENTS_CREATE'
  /**
   * The webhook topic for `fulfillments/update` events. Occurs whenever a
   * fulfillment is updated. Requires at least one of the following scopes:
   * read_fulfillments, read_marketplace_orders.
   */
  | 'FULFILLMENTS_UPDATE'
  /**
   * The webhook topic for `fulfillment_events/create` events. Occurs whenever a
   * fulfillment event is created. Requires the `read_fulfillments` scope.
   */
  | 'FULFILLMENT_EVENTS_CREATE'
  /**
   * The webhook topic for `fulfillment_events/delete` events. Occurs whenever a
   * fulfillment event is deleted. Requires the `read_fulfillments` scope.
   */
  | 'FULFILLMENT_EVENTS_DELETE'
  /**
   * The webhook topic for `fulfillment_orders/cancellation_request_accepted`
   * events. Occurs when a 3PL accepts a fulfillment cancellation request, received
   * from a merchant. Requires at least one of the following scopes:
   * read_merchant_managed_fulfillment_orders, read_assigned_fulfillment_orders,
   * read_third_party_fulfillment_orders, read_marketplace_fulfillment_orders.
   */
  | 'FULFILLMENT_ORDERS_CANCELLATION_REQUEST_ACCEPTED'
  /**
   * The webhook topic for `fulfillment_orders/cancellation_request_rejected`
   * events. Occurs when a 3PL rejects a fulfillment cancellation request, received
   * from a merchant. Requires at least one of the following scopes:
   * read_merchant_managed_fulfillment_orders, read_assigned_fulfillment_orders,
   * read_third_party_fulfillment_orders, read_marketplace_fulfillment_orders.
   */
  | 'FULFILLMENT_ORDERS_CANCELLATION_REQUEST_REJECTED'
  /**
   * The webhook topic for `fulfillment_orders/cancellation_request_submitted`
   * events. Occurs when a merchant requests a fulfillment request to be cancelled
   * after that request was approved by a 3PL. Requires at least one of the
   * following scopes: read_merchant_managed_fulfillment_orders,
   * read_assigned_fulfillment_orders, read_third_party_fulfillment_orders,
   * read_marketplace_fulfillment_orders.
   */
  | 'FULFILLMENT_ORDERS_CANCELLATION_REQUEST_SUBMITTED'
  /**
   * The webhook topic for `fulfillment_orders/cancelled` events. Occurs when a
   * fulfillment order is cancelled. Requires at least one of the following scopes:
   * read_merchant_managed_fulfillment_orders, read_assigned_fulfillment_orders,
   * read_third_party_fulfillment_orders, read_marketplace_fulfillment_orders.
   */
  | 'FULFILLMENT_ORDERS_CANCELLED'
  /**
   * The webhook topic for `fulfillment_orders/fulfillment_request_accepted`
   * events. Occurs when a fulfillment service accepts a request to fulfill a
   * fulfillment order. Requires at least one of the following scopes:
   * read_merchant_managed_fulfillment_orders, read_assigned_fulfillment_orders,
   * read_third_party_fulfillment_orders, read_marketplace_fulfillment_orders.
   */
  | 'FULFILLMENT_ORDERS_FULFILLMENT_REQUEST_ACCEPTED'
  /**
   * The webhook topic for `fulfillment_orders/fulfillment_request_rejected`
   * events. Occurs when a 3PL rejects a fulfillment request that was sent by a
   * merchant. Requires at least one of the following scopes:
   * read_merchant_managed_fulfillment_orders, read_assigned_fulfillment_orders,
   * read_third_party_fulfillment_orders, read_marketplace_fulfillment_orders.
   */
  | 'FULFILLMENT_ORDERS_FULFILLMENT_REQUEST_REJECTED'
  /**
   * The webhook topic for `fulfillment_orders/fulfillment_request_submitted`
   * events. Occurs when a merchant submits a fulfillment request to a 3PL.
   * Requires at least one of the following scopes:
   * read_merchant_managed_fulfillment_orders, read_assigned_fulfillment_orders,
   * read_third_party_fulfillment_orders, read_marketplace_fulfillment_orders.
   */
  | 'FULFILLMENT_ORDERS_FULFILLMENT_REQUEST_SUBMITTED'
  /**
   * The webhook topic for
   * `fulfillment_orders/fulfillment_service_failed_to_complete` events. Occurs
   * when a fulfillment service intends to close an in_progress fulfillment order.
   * Requires at least one of the following scopes:
   * read_merchant_managed_fulfillment_orders, read_assigned_fulfillment_orders,
   * read_third_party_fulfillment_orders, read_marketplace_fulfillment_orders.
   */
  | 'FULFILLMENT_ORDERS_FULFILLMENT_SERVICE_FAILED_TO_COMPLETE'
  /**
   * The webhook topic for `fulfillment_orders/hold_released` events. Occurs
   * whenever a fulfillment order hold is released. Requires at least one of the
   * following scopes: read_merchant_managed_fulfillment_orders,
   * read_assigned_fulfillment_orders, read_third_party_fulfillment_orders,
   * read_marketplace_fulfillment_orders.
   */
  | 'FULFILLMENT_ORDERS_HOLD_RELEASED'
  /**
   * The webhook topic for
   * `fulfillment_orders/line_items_prepared_for_local_delivery` events. Occurs
   * whenever a fulfillment order's line items are prepared for local delivery.
   * Requires at least one of the following scopes:
   * read_merchant_managed_fulfillment_orders, read_assigned_fulfillment_orders,
   * read_third_party_fulfillment_orders, read_marketplace_fulfillment_orders.
   */
  | 'FULFILLMENT_ORDERS_LINE_ITEMS_PREPARED_FOR_LOCAL_DELIVERY'
  /**
   * The webhook topic for `fulfillment_orders/line_items_prepared_for_pickup`
   * events. Triggers when one or more of the line items for a fulfillment order
   * are prepared for pickup Requires at least one of the following scopes:
   * read_merchant_managed_fulfillment_orders, read_assigned_fulfillment_orders,
   * read_third_party_fulfillment_orders, read_marketplace_fulfillment_orders.
   */
  | 'FULFILLMENT_ORDERS_LINE_ITEMS_PREPARED_FOR_PICKUP'
  /**
   * The webhook topic for `fulfillment_orders/merged` events. Occurs when multiple
   * fulfillment orders are merged into a single fulfillment order. Requires at
   * least one of the following scopes: read_merchant_managed_fulfillment_orders,
   * read_assigned_fulfillment_orders, read_third_party_fulfillment_orders.
   */
  | 'FULFILLMENT_ORDERS_MERGED'
  /**
   * The webhook topic for `fulfillment_orders/moved` events. Occurs whenever the
   * location which is assigned to fulfill one or more fulfillment order line items is changed.
   *
   * * `original_fulfillment_order` - The final state of the original fulfillment order.
   * * `moved_fulfillment_order` - The fulfillment order which now contains the re-assigned line items.
   * * `source_location` - The original location which was assigned to fulfill the
   * line items (available as of the `2023-04` API version).
   * * `destination_location_id` - The ID of the location which is now responsible for fulfilling the line items.
   *
   * **Note:** The [assignedLocation](https://shopify.dev/docs/api/admin-graphql/latest/objects/fulfillmentorder#field-fulfillmentorder-assignedlocation)
   * of the `original_fulfillment_order` might be changed by the move operation.
   * If you need to determine the originally assigned location, then you should refer to the `source_location`.
   *
   * [Learn more about moving line items](https://shopify.dev/docs/api/admin-graphql/latest/mutations/fulfillmentOrderMove).
   *  Requires at least one of the following scopes:
   * read_merchant_managed_fulfillment_orders, read_assigned_fulfillment_orders,
   * read_third_party_fulfillment_orders, read_marketplace_fulfillment_orders.
   */
  | 'FULFILLMENT_ORDERS_MOVED'
  /**
   * The webhook topic for `fulfillment_orders/order_routing_complete` events.
   * Occurs when an order has finished being routed and it's fulfillment orders
   * assigned to a fulfillment service's location. Requires at least one of the
   * following scopes: read_merchant_managed_fulfillment_orders,
   * read_assigned_fulfillment_orders, read_third_party_fulfillment_orders,
   * read_buyer_membership_orders, read_marketplace_fulfillment_orders.
   */
  | 'FULFILLMENT_ORDERS_ORDER_ROUTING_COMPLETE'
  /**
   * The webhook topic for `fulfillment_orders/placed_on_hold` events. Occurs when
   * a fulfillment order is placed on hold. Requires at least one of the following
   * scopes: read_merchant_managed_fulfillment_orders,
   * read_assigned_fulfillment_orders, read_third_party_fulfillment_orders,
   * read_marketplace_fulfillment_orders.
   */
  | 'FULFILLMENT_ORDERS_PLACED_ON_HOLD'
  /**
   * The webhook topic for `fulfillment_orders/ready_to_fulfill` events.
   * [Deprecated: subscribe to fulfillment_orders/order_routing_complete instead]
   * Occurs whenever a fulfillment order is ready to fulfill. Requires at least one
   * of the following scopes: read_merchant_managed_fulfillment_orders,
   * read_assigned_fulfillment_orders, read_third_party_fulfillment_orders.
   */
  | 'FULFILLMENT_ORDERS_READY_TO_FULFILL'
  /**
   * The webhook topic for `fulfillment_orders/rescheduled` events. Triggers when a fulfillment order is rescheduled.
   *
   * Fulfillment orders may be merged if they have the same `fulfillAt` datetime.
   * If the fulfillment order is merged then the resulting fulfillment order will be indicated in the webhook body.
   * Otherwise it will be the original fulfillment order with an updated `fulfill_at` datetime.
   *  Requires at least one of the following scopes:
   * read_merchant_managed_fulfillment_orders, read_assigned_fulfillment_orders,
   * read_third_party_fulfillment_orders, read_marketplace_fulfillment_orders.
   */
  | 'FULFILLMENT_ORDERS_RESCHEDULED'
  /**
   * The webhook topic for `fulfillment_orders/scheduled_fulfillment_order_ready`
   * events. Occurs whenever a fulfillment order which was scheduled becomes due.
   * Requires at least one of the following scopes:
   * read_merchant_managed_fulfillment_orders, read_assigned_fulfillment_orders,
   * read_third_party_fulfillment_orders, read_marketplace_fulfillment_orders.
   */
  | 'FULFILLMENT_ORDERS_SCHEDULED_FULFILLMENT_ORDER_READY'
  /**
   * The webhook topic for `fulfillment_orders/split` events. Occurs when a
   * fulfillment order is split into multiple fulfillment orders. Requires at least
   * one of the following scopes: read_merchant_managed_fulfillment_orders,
   * read_assigned_fulfillment_orders, read_third_party_fulfillment_orders.
   */
  | 'FULFILLMENT_ORDERS_SPLIT'
  /**
   * The webhook topic for `inventory_items/create` events. Occurs whenever an
   * inventory item is created. Requires the `read_inventory` scope.
   */
  | 'INVENTORY_ITEMS_CREATE'
  /**
   * The webhook topic for `inventory_items/delete` events. Occurs whenever an
   * inventory item is deleted. Requires the `read_inventory` scope.
   */
  | 'INVENTORY_ITEMS_DELETE'
  /**
   * The webhook topic for `inventory_items/update` events. Occurs whenever an
   * inventory item is updated. Requires the `read_inventory` scope.
   */
  | 'INVENTORY_ITEMS_UPDATE'
  /**
   * The webhook topic for `inventory_levels/connect` events. Occurs whenever an
   * inventory level is connected. Requires the `read_inventory` scope.
   */
  | 'INVENTORY_LEVELS_CONNECT'
  /**
   * The webhook topic for `inventory_levels/disconnect` events. Occurs whenever an
   * inventory level is disconnected. Requires the `read_inventory` scope.
   */
  | 'INVENTORY_LEVELS_DISCONNECT'
  /**
   * The webhook topic for `inventory_levels/update` events. Occurs whenever an
   * inventory level is updated. Requires the `read_inventory` scope.
   */
  | 'INVENTORY_LEVELS_UPDATE'
  /** The webhook topic for `locales/create` events. Occurs whenever a shop locale is created Requires the `read_locales` scope. */
  | 'LOCALES_CREATE'
  /**
   * The webhook topic for `locales/destroy` events. Occurs whenever a shop locale
   * is destroyed Requires the `read_locales` scope.
   */
  | 'LOCALES_DESTROY'
  /**
   * The webhook topic for `locales/update` events. Occurs whenever a shop locale
   * is updated, such as published or unpublished Requires the `read_locales` scope.
   */
  | 'LOCALES_UPDATE'
  /**
   * The webhook topic for `locations/activate` events. Occurs whenever a
   * deactivated location is re-activated. Requires the `read_locations` scope.
   */
  | 'LOCATIONS_ACTIVATE'
  /**
   * The webhook topic for `locations/create` events. Occurs whenever a location is
   * created. Requires the `read_locations` scope.
   */
  | 'LOCATIONS_CREATE'
  /**
   * The webhook topic for `locations/deactivate` events. Occurs whenever a
   * location is deactivated. Requires the `read_locations` scope.
   */
  | 'LOCATIONS_DEACTIVATE'
  /**
   * The webhook topic for `locations/delete` events. Occurs whenever a location is
   * deleted. Requires the `read_locations` scope.
   */
  | 'LOCATIONS_DELETE'
  /**
   * The webhook topic for `locations/update` events. Occurs whenever a location is
   * updated. Requires the `read_locations` scope.
   */
  | 'LOCATIONS_UPDATE'
  /**
   * The webhook topic for `marketplace_payments_configurations/update` events.
   * Occurs when the ready status of a marketplace payments configuration feature
   * has been updated. Requires the `read_marketplace_payments_configurations` scope.
   */
  | 'MARKETPLACE_PAYMENTS_CONFIGURATIONS_UPDATE'
  /** The webhook topic for `markets/create` events. Occurs when a new market is created. Requires the `read_markets` scope. */
  | 'MARKETS_CREATE'
  /** The webhook topic for `markets/delete` events. Occurs when a market is deleted. Requires the `read_markets` scope. */
  | 'MARKETS_DELETE'
  /** The webhook topic for `markets/update` events. Occurs when a market is updated. Requires the `read_markets` scope. */
  | 'MARKETS_UPDATE'
  /**
   * The webhook topic for `metafield_definitions/create` events. Occurs when a
   * metafield definition is created. Requires the `read_content` scope.
   */
  | 'METAFIELD_DEFINITIONS_CREATE'
  /**
   * The webhook topic for `metafield_definitions/delete` events. Occurs when a
   * metafield definition is deleted. Requires the `read_content` scope.
   */
  | 'METAFIELD_DEFINITIONS_DELETE'
  /**
   * The webhook topic for `metafield_definitions/update` events. Occurs when a
   * metafield definition is updated. Requires the `read_content` scope.
   */
  | 'METAFIELD_DEFINITIONS_UPDATE'
  /**
   * The webhook topic for `metaobjects/create` events. Occurs when a metaobject is
   * created. Requires the `read_metaobjects` scope.
   */
  | 'METAOBJECTS_CREATE'
  /**
   * The webhook topic for `metaobjects/delete` events. Occurs when a metaobject is
   * deleted. Requires the `read_metaobjects` scope.
   */
  | 'METAOBJECTS_DELETE'
  /**
   * The webhook topic for `metaobjects/update` events. Occurs when a metaobject is
   * updated. Requires the `read_metaobjects` scope.
   */
  | 'METAOBJECTS_UPDATE'
  /**
   * The webhook topic for `orders/cancelled` events. Occurs whenever an order is
   * cancelled. Requires at least one of the following scopes: read_orders,
   * read_marketplace_orders, read_buyer_membership_orders.
   */
  | 'ORDERS_CANCELLED'
  /**
   * The webhook topic for `orders/create` events. Occurs whenever an order is
   * created. Requires at least one of the following scopes: read_orders,
   * read_marketplace_orders.
   */
  | 'ORDERS_CREATE'
  /** The webhook topic for `orders/delete` events. Occurs whenever an order is deleted. Requires the `read_orders` scope. */
  | 'ORDERS_DELETE'
  /**
   * The webhook topic for `orders/edited` events. Occurs whenever an order is
   * edited. Requires at least one of the following scopes: read_orders,
   * read_marketplace_orders, read_buyer_membership_orders.
   */
  | 'ORDERS_EDITED'
  /**
   * The webhook topic for `orders/fulfilled` events. Occurs whenever an order is
   * fulfilled. Requires at least one of the following scopes: read_orders,
   * read_marketplace_orders.
   */
  | 'ORDERS_FULFILLED'
  /**
   * The webhook topic for `orders/paid` events. Occurs whenever an order is paid.
   * Requires at least one of the following scopes: read_orders,
   * read_marketplace_orders.
   */
  | 'ORDERS_PAID'
  /**
   * The webhook topic for `orders/partially_fulfilled` events. Occurs whenever an
   * order is partially fulfilled. Requires at least one of the following scopes:
   * read_orders, read_marketplace_orders.
   */
  | 'ORDERS_PARTIALLY_FULFILLED'
  /**
   * The webhook topic for `orders/risk_assessment_changed` events. Triggers when a
   * new risk assessment is available on the order.
   * This can be the first or a subsequent risk assessment.
   * New risk assessments can be provided until the order is marked as fulfilled.
   * Includes the risk level, risk facts and the provider. Does not include the risk recommendation for the order.
   * The order and shop are identified in the headers.
   *  Requires the `read_orders` scope.
   */
  | 'ORDERS_RISK_ASSESSMENT_CHANGED'
  /**
   * The webhook topic for `orders/shopify_protect_eligibility_changed` events.
   * Occurs whenever Shopify Protect's eligibility for an order is changed.
   * Requires the `read_orders` scope.
   */
  | 'ORDERS_SHOPIFY_PROTECT_ELIGIBILITY_CHANGED'
  /**
   * The webhook topic for `orders/updated` events. Occurs whenever an order is
   * updated. Requires at least one of the following scopes: read_orders,
   * read_marketplace_orders, read_buyer_membership_orders.
   */
  | 'ORDERS_UPDATED'
  /**
   * The webhook topic for `order_transactions/create` events. Occurs when a order
   * transaction is created or when it's status is updated. Only occurs for
   * transactions with a status of success, failure or error. Requires at least one
   * of the following scopes: read_orders, read_marketplace_orders,
   * read_buyer_membership_orders.
   */
  | 'ORDER_TRANSACTIONS_CREATE'
  /**
   * The webhook topic for `payment_schedules/due` events. Occurs whenever payment
   * schedules are due. Requires the `read_payment_terms` scope.
   */
  | 'PAYMENT_SCHEDULES_DUE'
  /**
   * The webhook topic for `payment_terms/create` events. Occurs whenever payment
   * terms are created. Requires the `read_payment_terms` scope.
   */
  | 'PAYMENT_TERMS_CREATE'
  /**
   * The webhook topic for `payment_terms/delete` events. Occurs whenever payment
   * terms are deleted. Requires the `read_payment_terms` scope.
   */
  | 'PAYMENT_TERMS_DELETE'
  /**
   * The webhook topic for `payment_terms/update` events. Occurs whenever payment
   * terms are updated. Requires the `read_payment_terms` scope.
   */
  | 'PAYMENT_TERMS_UPDATE'
  /** The webhook topic for `products/create` events. Occurs whenever a product is created. Requires the `read_products` scope. */
  | 'PRODUCTS_CREATE'
  /** The webhook topic for `products/delete` events. Occurs whenever a product is deleted. Requires the `read_products` scope. */
  | 'PRODUCTS_DELETE'
  /**
   * The webhook topic for `products/update` events. Occurs whenever a product is
   * updated, ordered, or variants are added, removed or updated. Requires the
   * `read_products` scope.
   */
  | 'PRODUCTS_UPDATE'
  /**
   * The webhook topic for `product_feeds/create` events. Triggers when product
   * feed is created Requires the `read_product_listings` scope.
   */
  | 'PRODUCT_FEEDS_CREATE'
  /**
   * The webhook topic for `product_feeds/exchange_rate_change` events. Occurs
   * whenever exchange rates change Requires the `read_product_listings` scope.
   */
  | 'PRODUCT_FEEDS_EXCHANGE_RATE_CHANGE'
  /**
   * The webhook topic for `product_feeds/full_sync` events. Triggers when a full
   * sync for a product feed is performed Requires the `read_product_listings` scope.
   */
  | 'PRODUCT_FEEDS_FULL_SYNC'
  /**
   * The webhook topic for `product_feeds/full_sync_finish` events. Triggers when a
   * full sync finishes Requires the `read_product_listings` scope.
   */
  | 'PRODUCT_FEEDS_FULL_SYNC_FINISH'
  /**
   * The webhook topic for `product_feeds/incremental_sync` events. Occurs whenever
   * a product publication is created, updated or removed for a product feed
   * Requires the `read_product_listings` scope.
   */
  | 'PRODUCT_FEEDS_INCREMENTAL_SYNC'
  /**
   * The webhook topic for `product_feeds/incremental_update` events. Occurs
   * whenever a product or variant is changed Requires the `read_product_listings` scope.
   */
  | 'PRODUCT_FEEDS_INCREMENTAL_UPDATE'
  /**
   * The webhook topic for `product_feeds/update` events. Triggers when product
   * feed is updated Requires the `read_product_listings` scope.
   */
  | 'PRODUCT_FEEDS_UPDATE'
  /**
   * The webhook topic for `product_listings/add` events. Occurs whenever an active
   * product is listed on a channel. Requires the `read_product_listings` scope.
   */
  | 'PRODUCT_LISTINGS_ADD'
  /**
   * The webhook topic for `product_listings/remove` events. Occurs whenever a
   * product listing is removed from the channel. Requires the
   * `read_product_listings` scope.
   */
  | 'PRODUCT_LISTINGS_REMOVE'
  /**
   * The webhook topic for `product_listings/update` events. Occurs whenever a
   * product publication is updated. Requires the `read_product_listings` scope.
   */
  | 'PRODUCT_LISTINGS_UPDATE'
  /**
   * The webhook topic for `product_operations/finish` events. Triggers when a
   * product operation completes Requires the `read_products` scope.
   */
  | 'PRODUCT_OPERATIONS_FINISH'
  /**
   * The webhook topic for `product_option/value_added` events. Occurs whenever a
   * value is added to a product option. Requires the `read_products` scope.
   */
  | 'PRODUCT_OPTION_VALUE_ADDED'
  /**
   * The webhook topic for `product_publications/create` events. Occurs whenever a
   * product publication for an active product is created, or whenever an existing
   * product publication is published on the app that is subscribed to this webhook
   * topic. Note that a webhook is only emitted when there are publishing changes
   * to the app that is subscribed to the topic (ie. no webhook will be emitted if
   * there is a publishing change to the online store and the webhook subscriber of
   * the topic is a third-party app). Requires the `read_publications` scope.
   */
  | 'PRODUCT_PUBLICATIONS_CREATE'
  /**
   * The webhook topic for `product_publications/delete` events. Occurs whenever a
   * product publication for an active product is removed, or whenever an existing
   * product publication is unpublished from the app that is subscribed to this
   * webhook topic. Note that a webhook is only emitted when there are publishing
   * changes to the app that is subscribed to the topic (ie. no webhook will be
   * emitted if there is a publishing change to the online store and the webhook
   * subscriber of the topic is a third-party app). Requires the
   * `read_publications` scope.
   */
  | 'PRODUCT_PUBLICATIONS_DELETE'
  /**
   * The webhook topic for `product_publications/update` events. Occurs whenever a
   * product publication is updated from the app that is subscribed to this webhook
   * topic. Note that a webhook is only emitted when there are publishing changes
   * to the app that is subscribed to the topic (ie. no webhook will be emitted if
   * there is a publishing change to the online store and the webhook subscriber of
   * the topic is a third-party app). Requires the `read_publications` scope.
   */
  | 'PRODUCT_PUBLICATIONS_UPDATE'
  /**
   * The webhook topic for `profiles/create` events. Occurs whenever a delivery
   * profile is created Requires at least one of the following scopes:
   * read_shipping, read_assigned_shipping.
   */
  | 'PROFILES_CREATE'
  /**
   * The webhook topic for `profiles/delete` events. Occurs whenever a delivery
   * profile is deleted Requires at least one of the following scopes:
   * read_shipping, read_assigned_shipping.
   */
  | 'PROFILES_DELETE'
  /**
   * The webhook topic for `profiles/update` events. Occurs whenever a delivery
   * profile is updated Requires at least one of the following scopes:
   * read_shipping, read_assigned_shipping.
   */
  | 'PROFILES_UPDATE'
  /**
   * The webhook topic for `publications/delete` events. Occurs whenever a
   * publication is deleted. Requires the `read_publications` scope.
   */
  | 'PUBLICATIONS_DELETE'
  /**
   * The webhook topic for `purchase_orders/create` events. Triggers when a
   * purchase order is created. Requires the `read_inventory` scope.
   */
  | 'PURCHASE_ORDERS_CREATE'
  /**
   * The webhook topic for `purchase_orders/delete` events. Triggers when a
   * purchase order is deleted. Requires the `read_inventory` scope.
   */
  | 'PURCHASE_ORDERS_DELETE'
  /**
   * The webhook topic for `purchase_orders/mark_as_ordered` events. Triggers when
   * a purchase order is marked as ordered. Requires the `read_inventory` scope.
   */
  | 'PURCHASE_ORDERS_MARK_AS_ORDERED'
  /**
   * The webhook topic for `purchase_orders/receive` events. Triggers when a
   * purchase order is received. Requires the `read_inventory` scope.
   */
  | 'PURCHASE_ORDERS_RECEIVE'
  /**
   * The webhook topic for `purchase_orders/update` events. Triggers when a
   * purchase order is updated. Requires the `read_inventory` scope.
   */
  | 'PURCHASE_ORDERS_UPDATE'
  /**
   * The webhook topic for `refunds/create` events. Occurs whenever a new refund is
   * created without errors on an order, independent from the movement of money.
   * Requires at least one of the following scopes: read_orders,
   * read_marketplace_orders, read_buyer_membership_orders.
   */
  | 'REFUNDS_CREATE'
  /**
   * The webhook topic for `returns/approve` events. Occurs whenever a return is
   * approved. This means `Return.status` is `OPEN`. Requires at least one of the
   * following scopes: read_returns, read_marketplace_returns,
   * read_buyer_membership_orders.
   */
  | 'RETURNS_APPROVE'
  /**
   * The webhook topic for `returns/cancel` events. Occurs whenever a return is
   * canceled. Requires at least one of the following scopes: read_orders,
   * read_marketplace_orders, read_returns, read_marketplace_returns,
   * read_buyer_membership_orders.
   */
  | 'RETURNS_CANCEL'
  /**
   * The webhook topic for `returns/close` events. Occurs whenever a return is
   * closed. Requires at least one of the following scopes: read_orders,
   * read_marketplace_orders, read_returns, read_marketplace_returns,
   * read_buyer_membership_orders.
   */
  | 'RETURNS_CLOSE'
  /**
   * The webhook topic for `returns/decline` events. Occurs whenever a return is
   * declined. This means `Return.status` is `DECLINED`. Requires at least one of
   * the following scopes: read_returns, read_marketplace_returns,
   * read_buyer_membership_orders.
   */
  | 'RETURNS_DECLINE'
  /**
   * The webhook topic for `returns/reopen` events. Occurs whenever a closed return
   * is reopened. Requires at least one of the following scopes: read_orders,
   * read_marketplace_orders, read_returns, read_marketplace_returns,
   * read_buyer_membership_orders.
   */
  | 'RETURNS_REOPEN'
  /**
   * The webhook topic for `returns/request` events. Occurs whenever a return is
   * requested. This means `Return.status` is `REQUESTED`. Requires at least one of
   * the following scopes: read_returns, read_marketplace_returns,
   * read_buyer_membership_orders.
   */
  | 'RETURNS_REQUEST'
  /**
   * The webhook topic for `returns/update` events. Occurs whenever a return is
   * updated. Requires at least one of the following scopes: read_returns,
   * read_marketplace_returns, read_buyer_membership_orders.
   */
  | 'RETURNS_UPDATE'
  /**
   * The webhook topic for `reverse_deliveries/attach_deliverable` events. Occurs
   * whenever a deliverable is attached to a reverse delivery.
   * This occurs when a reverse delivery is created or updated with delivery metadata.
   * Metadata includes the delivery method, label, and tracking information associated with a reverse delivery.
   *  Requires at least one of the following scopes: read_returns, read_marketplace_returns.
   */
  | 'REVERSE_DELIVERIES_ATTACH_DELIVERABLE'
  /**
   * The webhook topic for `reverse_fulfillment_orders/dispose` events. Occurs
   * whenever a disposition is made on a reverse fulfillment order.
   * This includes dispositions made on reverse deliveries that are associated with the reverse fulfillment order.
   *  Requires at least one of the following scopes: read_returns, read_marketplace_returns.
   */
  | 'REVERSE_FULFILLMENT_ORDERS_DISPOSE'
  /**
   * The webhook topic for `scheduled_product_listings/add` events. Occurs whenever
   * a product is scheduled to be published. Requires the `read_product_listings` scope.
   */
  | 'SCHEDULED_PRODUCT_LISTINGS_ADD'
  /**
   * The webhook topic for `scheduled_product_listings/remove` events. Occurs
   * whenever a product is no longer scheduled to be published. Requires the
   * `read_product_listings` scope.
   */
  | 'SCHEDULED_PRODUCT_LISTINGS_REMOVE'
  /**
   * The webhook topic for `scheduled_product_listings/update` events. Occurs
   * whenever a product's scheduled availability date changes. Requires the
   * `read_product_listings` scope.
   */
  | 'SCHEDULED_PRODUCT_LISTINGS_UPDATE'
  /** The webhook topic for `segments/create` events. Occurs whenever a segment is created. Requires the `read_customers` scope. */
  | 'SEGMENTS_CREATE'
  /** The webhook topic for `segments/delete` events. Occurs whenever a segment is deleted. Requires the `read_customers` scope. */
  | 'SEGMENTS_DELETE'
  /** The webhook topic for `segments/update` events. Occurs whenever a segment is updated. Requires the `read_customers` scope. */
  | 'SEGMENTS_UPDATE'
  /**
   * The webhook topic for `selling_plan_groups/create` events. Notifies when a
   * SellingPlanGroup is created. Requires the `read_products` scope.
   */
  | 'SELLING_PLAN_GROUPS_CREATE'
  /**
   * The webhook topic for `selling_plan_groups/delete` events. Notifies when a
   * SellingPlanGroup is deleted. Requires the `read_products` scope.
   */
  | 'SELLING_PLAN_GROUPS_DELETE'
  /**
   * The webhook topic for `selling_plan_groups/update` events. Notifies when a
   * SellingPlanGroup is updated. Requires the `read_products` scope.
   */
  | 'SELLING_PLAN_GROUPS_UPDATE'
  /**
   * The webhook topic for `shipping_addresses/create` events. Occurs whenever a
   * shipping address is created. Requires the `read_shipping` scope.
   */
  | 'SHIPPING_ADDRESSES_CREATE'
  /**
   * The webhook topic for `shipping_addresses/update` events. Occurs whenever a
   * shipping address is updated. Requires the `read_shipping` scope.
   */
  | 'SHIPPING_ADDRESSES_UPDATE'
  /** The webhook topic for `shop/update` events. Occurs whenever a shop is updated. */
  | 'SHOP_UPDATE'
  /**
   * The webhook topic for `subscription_billing_attempts/challenged` events.
   * Occurs when the financial instutition challenges the subscripttion billing
   * attempt charge as per 3D Secure. Requires the
   * `read_own_subscription_contracts` scope.
   */
  | 'SUBSCRIPTION_BILLING_ATTEMPTS_CHALLENGED'
  /**
   * The webhook topic for `subscription_billing_attempts/failure` events. Occurs
   * whenever a subscription billing attempt fails. Requires the
   * `read_own_subscription_contracts` scope.
   */
  | 'SUBSCRIPTION_BILLING_ATTEMPTS_FAILURE'
  /**
   * The webhook topic for `subscription_billing_attempts/success` events. Occurs
   * whenever a subscription billing attempt succeeds. Requires the
   * `read_own_subscription_contracts` scope.
   */
  | 'SUBSCRIPTION_BILLING_ATTEMPTS_SUCCESS'
  /**
   * The webhook topic for `subscription_billing_cycles/skip` events. Occurs
   * whenever a subscription contract billing cycle is skipped. Requires the
   * `read_own_subscription_contracts` scope.
   */
  | 'SUBSCRIPTION_BILLING_CYCLES_SKIP'
  /**
   * The webhook topic for `subscription_billing_cycles/unskip` events. Occurs
   * whenever a subscription contract billing cycle is unskipped. Requires the
   * `read_own_subscription_contracts` scope.
   */
  | 'SUBSCRIPTION_BILLING_CYCLES_UNSKIP'
  /**
   * The webhook topic for `subscription_billing_cycle_edits/create` events. Occurs
   * whenever a subscription contract billing cycle is edited. Requires the
   * `read_own_subscription_contracts` scope.
   */
  | 'SUBSCRIPTION_BILLING_CYCLE_EDITS_CREATE'
  /**
   * The webhook topic for `subscription_billing_cycle_edits/delete` events. Occurs
   * whenever a subscription contract billing cycle edit is deleted. Requires the
   * `read_own_subscription_contracts` scope.
   */
  | 'SUBSCRIPTION_BILLING_CYCLE_EDITS_DELETE'
  /**
   * The webhook topic for `subscription_billing_cycle_edits/update` events. Occurs
   * whenever a subscription contract billing cycle edit is updated. Requires the
   * `read_own_subscription_contracts` scope.
   */
  | 'SUBSCRIPTION_BILLING_CYCLE_EDITS_UPDATE'
  /**
   * The webhook topic for `subscription_contracts/activate` events. Occurs when a
   * subscription contract is activated. Requires the
   * `read_own_subscription_contracts` scope.
   */
  | 'SUBSCRIPTION_CONTRACTS_ACTIVATE'
  /**
   * The webhook topic for `subscription_contracts/cancel` events. Occurs when a
   * subscription contract is canceled. Requires the
   * `read_own_subscription_contracts` scope.
   */
  | 'SUBSCRIPTION_CONTRACTS_CANCEL'
  /**
   * The webhook topic for `subscription_contracts/create` events. Occurs whenever
   * a subscription contract is created. Requires the
   * `read_own_subscription_contracts` scope.
   */
  | 'SUBSCRIPTION_CONTRACTS_CREATE'
  /**
   * The webhook topic for `subscription_contracts/expire` events. Occurs when a
   * subscription contract expires. Requires the `read_own_subscription_contracts` scope.
   */
  | 'SUBSCRIPTION_CONTRACTS_EXPIRE'
  /**
   * The webhook topic for `subscription_contracts/fail` events. Occurs when a
   * subscription contract is failed. Requires the
   * `read_own_subscription_contracts` scope.
   */
  | 'SUBSCRIPTION_CONTRACTS_FAIL'
  /**
   * The webhook topic for `subscription_contracts/pause` events. Occurs when a
   * subscription contract is paused. Requires the
   * `read_own_subscription_contracts` scope.
   */
  | 'SUBSCRIPTION_CONTRACTS_PAUSE'
  /**
   * The webhook topic for `subscription_contracts/update` events. Occurs whenever
   * a subscription contract is updated. Requires the
   * `read_own_subscription_contracts` scope.
   */
  | 'SUBSCRIPTION_CONTRACTS_UPDATE'
  /** The webhook topic for `suppliers/create` events. Triggers when a supplier is created. Requires the `read_inventory` scope. */
  | 'SUPPLIERS_CREATE'
  /** The webhook topic for `suppliers/delete` events. Triggers when a supplier is deleted. Requires the `read_inventory` scope. */
  | 'SUPPLIERS_DELETE'
  /** The webhook topic for `suppliers/update` events. Triggers when a supplier is updated. Requires the `read_inventory` scope. */
  | 'SUPPLIERS_UPDATE'
  /**
   * The webhook topic for `tax_partners/update` events. Occurs whenever a tax
   * partner is created or updated. Requires the `read_taxes` scope.
   */
  | 'TAX_PARTNERS_UPDATE'
  /**
   * The webhook topic for `tax_services/create` events. Occurs whenever a tax
   * service is created. Requires the `read_taxes` scope.
   */
  | 'TAX_SERVICES_CREATE'
  /**
   * The webhook topic for `tax_services/update` events. Occurs whenver a tax
   * service is updated. Requires the `read_taxes` scope.
   */
  | 'TAX_SERVICES_UPDATE'
  /**
   * The webhook topic for `tax_summaries/create` events. Occurs when a tax summary
   * is created. Consumed by tax partners. Requires at least one of the following
   * scopes: read_fulfillments, read_marketplace_orders.
   */
  | 'TAX_SUMMARIES_CREATE'
  /**
   * The webhook topic for `tender_transactions/create` events. Occurs when a
   * tender transaction is created. Requires the `read_orders` scope.
   */
  | 'TENDER_TRANSACTIONS_CREATE'
  /**
   * The webhook topic for `themes/create` events. Occurs whenever a theme is
   * created. Does not occur when theme files are created. Requires the
   * `read_themes` scope.
   */
  | 'THEMES_CREATE'
  /**
   * The webhook topic for `themes/delete` events. Occurs whenever a theme is
   * deleted. Does not occur when theme files are deleted. Requires the
   * `read_themes` scope.
   */
  | 'THEMES_DELETE'
  /**
   * The webhook topic for `themes/publish` events. Occurs whenever a theme with
   * the main or mobile (deprecated) role is published. Requires the `read_themes` scope.
   */
  | 'THEMES_PUBLISH'
  /**
   * The webhook topic for `themes/update` events. Occurs whenever a theme is
   * updated. Does not occur when theme files are updated. Requires the
   * `read_themes` scope.
   */
  | 'THEMES_UPDATE'
  /**
   * The webhook topic for `translatable_content/create` events. Occurs whenever a
   * resource that has translatable content is created. A webhook per created
   * translatable field in the resource will be triggered. Requires the
   * `read_translations` scope.
   */
  | 'TRANSLATABLE_CONTENT_CREATE'
  /**
   * The webhook topic for `translatable_content/update` events. Occurs whenever a
   * resource that has translatable content is updated. A webhook per updated
   * translatable field in the resource will be triggered. Requires the
   * `read_translations` scope.
   */
  | 'TRANSLATABLE_CONTENT_UPDATE'
  /**
   * The webhook topic for `variants/in_stock` events. Occurs whenever a variant
   * becomes in stock. Requires the `read_products` scope.
   */
  | 'VARIANTS_IN_STOCK'
  /**
   * The webhook topic for `variants/out_of_stock` events. Occurs whenever a
   * variant becomes out of stock. Requires the `read_products` scope.
   */
  | 'VARIANTS_OUT_OF_STOCK'

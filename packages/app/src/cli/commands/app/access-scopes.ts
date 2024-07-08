/* eslint-disable no-restricted-syntax */
export const accessScopesContext = () => {
  return `Given these docs:
  ====
  ${ACCESS_SCOPES_PROMPT}
  ====

  and this example shopify.app.toml file:

  ====
  ${EXAMPLE_SHOPIFY_APP_TOML}
  ====

  You are a Shopify app developer.
  You can only answer back in in toml format. Do not include any backtick characters.
  Only include the content of the shopify.app.toml file, not the file itself.

  Give me a shopify.app.toml file for an app with the following description:
  `
}

export const ACCESS_SCOPES_PROMPT = `
---
gid: f39e856f-18bb-4b0e-8f04-c9667d678a1c
title: Shopify API access scopes
description: All apps need to request access to specific store data during the app authorization process. This is the complete list of available access scopes for the Admin and Storefront APIs.
---

All apps need to request access to specific store data during the app authorization process. This guide provides a complete list of available access scopes for the Admin, Storefront, and Payment Apps APIs.

## How it works
> Tip:
> For more information on how to configure your access scopes, refer to [app configuration](/docs/apps/build/cli-for-apps/app-configuration).

After you've [generated API credentials](/docs/apps/build/authentication-authorization/client-secrets), your app needs to [be authorized to access store data](/docs/apps/build/authentication-authorization/get-access-tokens/auth-code-grant/implement-auth-code-grants-manually#ask-for-permission).

Authorization is the process of giving permissions to apps. Users can authorize Shopify apps to access data in a store. For example, an app might be authorized to access orders and product data in a store.

An app can request authenticated or unauthenticated access scopes.

| Type of access scopes | Description | Example use cases |
|---|---|---|
| [Authenticated](#authenticated-access-scopes) | Controls access to resources in the [REST Admin API](/docs/api/admin-rest), [GraphQL Admin API](/docs/api/admin-graphql), and [Payments Apps API](/docs/api/payments-apps). <br></br>Authenticated access is intended for interacting with a store on behalf of a user. | <ul><li>Creating products</li><li>Managing discount codes</li></ul> |
| [Unauthenticated](#unauthenticated-access-scopes) | Controls an app's access to [Storefront API](/docs/api/storefront) objects. <br></br> Unauthenticated access is intended for interacting with a store on behalf of a customer. | <ul><li>Viewing products</li><li>Initiating a checkout</li></ul> |
| [Customer](#customer-access-scopes) | Controls an app's access to [Customer Account API](/docs/api/customer) objects. <br></br> Customer access is intended for interacting with data that belongs to a customer. | <ul><li>Viewing orders</li><li>Updating customer details</li></ul> |


## Authenticated access scopes

> Note:
> In the following table, access to some resources are marked with **permissions required**. In these cases, you must [request specific permission](#requesting-specific-permissions) to access data from the user in your Partner Dashboard.

Your app can request the following authenticated access scopes:

<table>
  <caption>Authenticated access scopes</caption>
  <tr>
    <th scope="col">Scope</th>
    <th scope="col">Access</th>
  </tr>
  <tr>
    <td><code>read_all_orders</code></td>
    <td><p>All relevant <a href="/docs/api/admin-graphql/latest/objects/Order">orders</a> rather than the default window of orders created within the last 60 days<span class="heading-flag heading-flag--restricted">Permissions required</span></p>
        <p>This access scope is used in conjunction with existing order scopes, for example <code>read_orders</code> or <code>write_orders</code>.</p>
        <p>You need to <a href="/docs/apps/build/authentication-authorization/get-access-tokens/auth-code-grant/implement-auth-code-grants-manually#orders-permissions">request permission for this access scope</a> from your Partner Dashboard before adding it to your app.</p></td>
  </tr>
  <tr>
    <td><code>read_assigned_fulfillment_orders</code>,<p><code>write_assigned_fulfillment_orders</code></p></td>
    <td><a href="/docs/api/admin-rest/latest/resources/assignedfulfillmentorder">FulfillmentOrder</a> resources assigned to a location managed by your <a href="/docs/api/admin-rest/latest/resources/fulfillmentservice">fulfillment service</a></td>
  </tr>
  <tr>
    <td><code>read_cart_transforms</code>,<p><code>write_cart_transforms</code></p></td>
    <td>Manage <a href="/docs/api/admin-graphql/unstable/objects/CartTransform">Cart Transform</a> objects to sell <a href="/docs/apps/build/product-merchandising/bundles/add-customized-bundle">bundles.</a></td>
  </tr>
  <tr>
    <td><code>read_checkouts</code>,<p><code>write_checkouts</code></p></td>
    <td><a href="/docs/api/admin-rest/latest/resources/checkout">Checkouts</a></td>
  </tr>
  <tr>
    <td><code>read_checkout_branding_settings</code>,<p><code>write_checkout_branding_settings</code></p></td>
    <td><a href="/docs/api/admin-graphql/latest/queries/checkoutBranding">Checkout branding</a></td>
  </tr>
  <tr>
    <td><code>read_content</code>,<p><lines><code>write_content</code></lines></p></td>
    <td><a href="/docs/api/admin-rest/latest/resources/article">Article</a>, <a href="/docs/api/admin-rest/latest/resources/blog">Blog</a>, <a href="/docs/api/admin-rest/latest/resources/comment">Comment</a>, <a href="/docs/api/admin-rest/latest/resources/page">Page</a>, <a href="/docs/api/admin-rest/latest/resources/redirect">Redirects</a>, and <a href="/docs/api/admin-graphql/latest/queries/metafieldDefinitions">Metafield Definitions</a></td>
  </tr>
  <tr>
    <td><code>read_customer_merge</code>,<p><code>write_customer_merge</code></p></td>
    <td><a href="/docs/api/admin-graphql/unstable/objects/CustomerMergePreview">CustomerMergePreview</a> and <a href="/docs/api/admin-graphql/unstable/objects/CustomerMergeRequest">CustomerMergeRequest</a></td>
  </tr>
  <tr>
    <td><code>read_customers</code>,<p><code>write_customers</code></p></td>
    <td><a href="/docs/api/admin-rest/latest/resources/customer">Customer</a> and <a href="/docs/api/admin-graphql/latest/objects/savedsearch">Saved Search</a></td>
  </tr>
  <tr>
    <td><code>read_customer_payment_methods</code></td>
    <td><p><a href="/docs/api/admin-graphql/latest/objects/customerpaymentmethod">CustomerPaymentMethod</a><span class="heading-flag heading-flag--restricted">Permissions required</span></p><p>You need to <a href="#subscription-apis-permissions">request permission for this access scope</a> from your Partner Dashboard before adding it to your app.</p></td>
  </tr>
  <tr>
    <td><code>read_delivery_customizations</code>,<p><code>write_delivery_customizations</code></p></td>
    <td><a href="/docs/api/admin-graphql/latest/objects/DeliveryCustomization">DeliveryCustomization</a></td>
  </tr>
  <tr>
    <td><code>read_discounts</code>,<p><code>write_discounts</code></p></td>
    <td>GraphQL Admin API <a href="docs/apps/build/discounts">Discounts features</a></td>
  </tr>
  <tr>
    <td><code>read_draft_orders</code>,<p><code>write_draft_orders</code></p></td>
    <td><a href="/docs/api/admin-rest/latest/resources/draftorder">Draft Order</a></td>
  </tr>
  <tr>
    <td><code>read_files</code>,<p><code>write_files</code></p></td>
    <td>GraphQL Admin API <a href="/docs/api/admin-graphql/latest/objects/genericfile">GenericFile</a> object and <a href="/docs/api/admin-graphql/latest/mutations/filecreate">fileCreate</a>, <a href="/docs/api/admin-graphql/latest/mutations/fileupdate">fileUpdate</a>, and <a href="/docs/api/admin-graphql/latest/mutations/filedelete">fileDelete</a> mutations</td>
  </tr>
  <tr>
    <td><code>read_fulfillments</code>,<p><code>write_fulfillments</code></p></td>
    <td><a href="/docs/api/admin-rest/latest/resources/fulfillmentservice">Fulfillment Service</a></td>
  </tr>
  <tr>
    <td><code>read_gift_cards</code>,<p><code>write_gift_cards</code></p></td>
    <td><a href="/docs/api/admin-rest/latest/resources/gift-card">Gift Card</a></td>
  </tr>
  <tr>
    <td><code>read_inventory</code>,<p><code>write_inventory</code></p></td>
    <td><a href="/docs/api/admin-rest/latest/resources/inventorylevel">Inventory Level</a> and <a href="/docs/api/admin-rest/latest/resources/inventoryitem">Inventory Item</a></td>
  </tr>
  <tr>
    <td><code>read_legal_policies</code></td>
    <td>GraphQL Admin API <a href="/docs/api/admin-graphql/latest/objects/shoppolicy">Shop Policy</a></td>
  </tr>
  <tr>
    <td><code>read_locales</code>,<p><code>write_locales</code></p></td>
    <td>GraphQL Admin API <a href="/docs/api/admin-graphql/latest/objects/shoplocale">Shop Locale</a></td>
  </tr>
  <tr>
    <td><code>write_locations</code></td>
    <td>GraphQL Admin API <a href="/docs/api/admin-graphql/latest/mutations/locationActivate">locationActivate</a>, <a href="/docs/api/admin-graphql/latest/mutations/locationAdd">locationAdd</a>, <a href="/docs/api/admin-graphql/latest/mutations/locationDeactivate">locationDeactivate</a>, <a href="/docs/api/admin-graphql/latest/mutations/locationDelete">locationDelete</a>, and <a href="/docs/api/admin-graphql/latest/mutations/locationEdit">locationEdit</a> mutations.</td>
  </tr>
  <tr>
    <td><code>read_locations</code></td>
    <td><a href="/docs/api/admin-rest/latest/resources/location">Location</a></td>
  </tr>
  <tr>
    <td><code>read_markets</code>,<p><code>write_markets</code></p></td>
    <td><a href="/docs/api/admin-graphql/latest/objects/market">Market</a></td>
  </tr>
  <tr>
    <td><code>read_metaobject_definitions</code>,<p><code>write_metaobject_definitions</code></td>
    <td><a href="/docs/api/admin-graphql/latest/objects/metaobjectdefinition">MetaobjectDefinition</a></td>
  </tr>
  <tr>
    <td><code>read_metaobjects</code>,<p><code>write_metaobjects</code></td>
    <td><a href="/docs/api/admin-graphql/latest/objects/metaobject">Metaobject</a></td>
  </tr>
  <tr>
    <td><code>read_marketing_events</code>,<p><code>write_marketing_events</code></p></td>
    <td><a href="/docs/api/admin-rest/latest/resources/marketingevent">Marketing Event</a></td>
  </tr>
  <tr>
    <td><code>read_merchant_approval_signals</code></td>
    <td><a href="/docs/api/admin-graphql/latest/objects/merchantapprovalsignals">MerchantApprovalSignals</a></td>
  </tr>
  <tr>
    <td><code>read_merchant_managed_fulfillment_orders</code>,<p><code>write_merchant_managed_fulfillment_orders</code></p></td>
    <td><a href="/docs/api/admin-rest/latest/resources/fulfillmentorder">FulfillmentOrder</a> resources assigned to merchant-managed locations</td>
  </tr>
  <tr>
    <td><code>read_orders</code>,<p><code>write_orders</code></p></td>
    <td><a href="/docs/api/admin-rest/latest/resources/abandoned-checkouts">Abandoned checkouts</a>, <a href="/docs/api/admin-rest/latest/resources/customer">Customer</a>, <a href="/docs/api/admin-rest/latest/resources/fulfillment">Fulfillment</a>, <a href="/docs/api/admin-rest/latest/resources/order">Order</a>, and <a href="/docs/api/admin-rest/latest/resources/transaction">Transaction</a> resources</td>
  </tr>
  <tr>
    <td><code>read_payment_mandate</code>,<p><code>write_payment_mandate</code></p></td>
    <td><a href="/docs/api/admin-graphql/latest/objects/PaymentMandate">PaymentMandate</a></td>
  </tr>
  <tr>
    <td><code>read_payment_terms</code>,<p><code>write_payment_terms</code></p></td>
    <td>GraphQL Admin API <a href="/docs/api/admin-graphql/latest/objects/paymentschedule">PaymentSchedule</a> and <a href="/docs/api/admin-graphql/latest/objects/paymentterms">PaymentTerms</a> objects</td>
  </tr>
  <tr>
    <td><code>read_price_rules</code>,<p><code>write_price_rules</code></p></td>
    <td><a href="/docs/api/admin-rest/latest/resources/pricerule">Price Rules</a></td>
  </tr>
  <tr>
    <td><code>read_products</code>,<p><code>write_products</code></p></td>
    <td><a href="/docs/api/admin-rest/latest/resources/product">Product</a>, <a href="/docs/api/admin-rest/latest/resources/product-variant">Product Variant</a>, <a href="/docs/api/admin-rest/latest/resources/product-image">Product Image</a>, <a href="/docs/api/admin-rest/latest/resources/collect">Collect</a>, <a href="/docs/api/admin-rest/latest/resources/customcollection">Custom Collection</a>, and <a href="/docs/api/admin-rest/latest/resources/smartcollection">Smart Collection</a></td>
  </tr>
  <tr>
    <td><code>read_product_listings</code></td>
    <td><a href="/docs/api/admin-rest/latest/resources/productlisting">Product Listing</a> and <a href="/docs/api/admin-rest/latest/resources/collectionlisting">Collection Listing</a></td>
  </tr>
  <tr>
    <td><code>read_publications</code>,<p><code>write_publications</code></p></td>
    <td><a href="/docs/api/admin-graphql/latest/mutations/productpublish">Product publishing</a> and <a href="/docs/api/admin-graphql/latest/mutations/collectionpublish">Collection publishing</a></td>
  </tr>
  <tr>
    <td><code>read_purchase_options</code>,<p><code>write_purchase_options</code></td>
    <td><a href="/docs/api/admin-graphql/latest/objects/SellingPlan">SellingPlan</a></td>
  </tr>
  <tr>
    <td><code>read_reports</code>,<p><code>write_reports</code></p></td>
    <td><a href="/docs/api/admin-rest/latest/resources/report">Reports</a></td>
  </tr>
  <tr>
    <td><code>read_resource_feedbacks</code>,<p><code>write_resource_feedbacks</code></p></td>
    <td><a href="/docs/api/admin-rest/latest/resources/resourcefeedback">ResourceFeedback</a></td>
  </tr>
  <tr>
    <td><code>read_script_tags</code>,<p><code>write_script_tags</code></p></td>
    <td><a href="/docs/api/admin-rest/latest/resources/scripttag">Script Tag</a></td>
  </tr>
  <tr>
    <td><code>read_shipping</code>,<p><code>write_shipping</code></p></td>
    <td><a href="/docs/api/admin-rest/latest/resources/carrierservice">Carrier Service</a>, <a href="/docs/api/admin-rest/latest/resources/country">Country</a>, and <a href="/docs/api/admin-rest/latest/resources/province">Province</a></td>
  </tr>
  <tr>
    <td><code>read_shopify_payments_disputes</code></td>
    <td>Shopify Payments <a href="/docs/api/admin-rest/latest/resources/dispute">Dispute</a> resource</td>
  </tr>
  <tr>
    <td><code>read_shopify_payments_payouts</code></td>
    <td>Shopify Payments <a href="/docs/api/admin-rest/latest/resources/payout">Payout</a>, <a href="/docs/api/admin-rest/latest/resources/balance">Balance</a>, and <a href="/docs/api/admin-rest/latest/resources/transaction">Transaction</a> resources</td>
  </tr>
  <tr>
    <td><code>read_store_credit_accounts</code></td>
    <td><a href="/docs/api/admin-graphql/unstable/objects/StoreCreditAccount">StoreCreditAccount</a></td>
  </tr>
  <tr>
    <td><code>read_store_credit_account_transactions</code>,<p><code>write_store_credit_account_transactions</code></td>
    <td><a href="/docs/api/admin-graphql/unstable/objects/StoreCreditAccountDebitTransaction">StoreCreditAccountDebitTransaction</a> and <a href="/docs/api/admin-graphql/unstable/objects/StoreCreditAccountCreditTransaction">StoreCreditAccountCreditTransaction</a></td>
  </tr>
  <tr>
    <td><code>read_own_subscription_contracts</code>,<p><code>write_own_subscription_contracts</code></td>
    <td><p><a href="/docs/api/admin-graphql/latest/objects/SubscriptionContract">SubscriptionContract</a><span class="heading-flag heading-flag--restricted">Permissions required</span></p><p>You need to <a href="#subscription-apis-permissions">request permission for these access scopes</a> from your Partner Dashboard before adding them to your app.</p></td>
  </tr>
  <tr>
    <td><code>read_returns</code>,<p><code>write_returns</code></p></td>
    <td><a href="/docs/api/admin-graphql/unstable/objects/Return">Return</a> object</td>
  </tr>
  <tr>
    <td><code>read_themes</code>,<p><code>write_themes</code></p></td>
    <td><a href="/docs/api/admin-rest/latest/resources/asset">Asset</a> and <a href="/docs/api/admin-rest/latest/resources/theme">Theme</a></td>
  </tr>
  <tr>
    <td><code>read_translations</code>,<p><code>write_translations</code></p></td>
    <td>GraphQL Admin API <a href="/docs/api/admin-graphql/latest/queries/translatableresource">Translatable</a> object</td>
  </tr>
  <tr>
    <td><code>read_third_party_fulfillment_orders</code>,<p><code>write_third_party_fulfillment_orders</code></p></td>
    <td><a href="/docs/api/admin-rest/latest/resources/fulfillmentorder">FulfillmentOrder</a> resources assigned to a location managed by any <a href="/docs/api/admin-rest/latest/resources/fulfillmentservice">fulfillment service</a></td>
  </tr>
  <tr>
    <td><code>read_users</code></td>
    <td><a href="/docs/api/admin-rest/latest/resources/user">User</a> and <a href="/docs/api/admin-graphql/latest/objects/staffmember">StaffMember</a><span class="heading-flag heading-flag--plus">SHOPIFY PLUS</span></td>
  </tr>
  <tr>
    <td><code>read_order_edits</code>,<p><code>write_order_edits</code></p></td>
    <td>GraphQL Admin API <a href="/docs/api/admin-graphql/latest/unions/OrderStagedChange">OrderStagedChange</a> types and <a href="/docs/apps/build/orders-fulfillment/order-management-apps/edit-orders">order editing</a> features</td>
  </tr>
  <tr>
    <td><code>write_payment_gateways</code></td>
    <td>Payments Apps API <a href="/docs/api/payments-apps/latest/mutations/paymentsAppConfigure">paymentsAppConfigure</a></td>
  </tr>
  <tr>
    <td><code>write_payment_sessions</code></td>
    <td>Payments Apps API <a href="/docs/api/payments-apps/latest/objects/PaymentSession">Payment</a>, <a href="/docs/api/payments-apps/latest/objects/CaptureSession">Capture</a>,  <a href="/docs/api/payments-apps/latest/objects/RefundSession">Refund</a> and <a href="/docs/api/payments-apps/latest/objects/VoidSession">Void</a></td>
  </tr>
  <tr>
    <td><code>write_pixels</code>,<p><code>read_customer_events</code></p></td>
    <td><a href="/docs/api/web-pixels-api">Web Pixels API</a></td>
  </tr>
  <tr>
    <td><code>write_privacy_settings</code>,<p><code>read_privacy_settings</code></p></td>
    <td>GraphQL Admin API <a href="/docs/api/admin-graphql/unstable/objects/CookieBanner">CookieBanner</a>, <a href="/docs/api/admin-graphql/unstable/objects/PrivacySettings">PrivacySettings</a> objects and <a href="/docs/api/admin-graphql/unstable/mutations/consentPolicyUpdate">consentPolicyUpdate</a>, <a href="/docs/api/admin-graphql/2024-07/mutations/dataSaleOptOut">dataSaleOptOut</a> mutations</td>
  </tr>
  <tr>
    <td><code>read_validations</code>,<p><code>write_validations</code></p></td>
    <td>GraphQL Admin API  <code><a href="/docs/api/admin-graphql/latest/objects/Validation">Validation</a></code> object</td>
  </tr>
</table>

### Requesting specific permissions

Follow the procedures below to request specific permissions to request access scopes in the Partner Dashboard.

#### Orders permissions

By default, you have access to the last 60 days' worth of orders for a store. To access all the orders, you need to request access to the \`read_all_orders\` scope from the user:

1. From the Partner Dashboard, go to [**Apps**](https://www.shopify.com/admin/apps).
1. Click the name of your app.
1. Click **API access**.
1. In the **Access requests** section, on the **Read all orders scope** card, click **Request access**.
1. On the **Orders** page that opens, describe your app and why you’re applying for access.
1. Click **Request access**.

If Shopify approves your request, then you can add the \`read_all_orders\` scope to your app along with \`read_orders\` or \`write_orders\`.

#### Subscription APIs permissions

Subscription apps let users sell subscription products that generate multiple orders on a specific billing frequency.

With subscription products, the app user isn't required to get customer approval for each subsequent order after the initial subscription purchase. As a result, your app needs to request the required protected access scopes to use Subscription APIs from the app user:

1. From the Partner Dashboard, go to [**Apps**](https://www.shopify.com/admin/apps).
1. Click the name of your app.
1. Click **API access**.
1. In the **Access requests** section, on the **Access Subscriptions APIs** card, click **Request access**.
1. On the **Subscriptions** page that opens, describe why you’re applying for access.
1. Click **Request access**.

If Shopify approves your request, then you can add the \`read_customer_payment_methods\` and \`write_own_subscription_contracts\` scopes to your app.

#### Protected customer data permissions

By default, apps don't have access to any protected customer data. To access protected customer data, you must meet our [protected customer data requirements](/docs/apps/launch/protected-customer-data#requirements). You can add the relevant scopes to your app, but the API won't return data from non-development stores until your app is configured and approved for protected customer data use.

## Unauthenticated access scopes

Unauthenticated access scopes provide apps with read-only access to the [Storefront API](/docs/api/storefront). Unauthenticated access is intended for interacting with a store on behalf of a customer. For example, an app might need to do one or more of following tasks:

- Read products and collections
- Create customers and update customer accounts
- Query international prices for products and orders
- Interact with a cart during a customer's session
- Initiate a checkout

### Request scopes

To request unauthenticated access scopes for an app, select them when you [generate API credentials](/docs/apps/build/authentication-authorization/client-secrets) or [change granted access scopes](/docs/apps/build/authentication-authorization/get-access-tokens/auth-code-grant/implement-auth-code-grants-manually#step-7-change-the-granted-scopes-optional).

To request access scopes or permissions for the Headless channel, refer to [managing the Headless channel](/docs/storefronts/headless/building-with-the-storefront-api/manage-headless-channels#request-storefront-permissions).

{% if feature_flags.schedule_test %}
You can request the following unauthenticated access scopes:
{% else %}
Your can request the following unauthenticated access scopes:
{% endif %}

<table>
  <caption>Unauthenticated access scopes</caption>
  <tr>
    <th style="width:20vw" scope="col">Scope</th>
    <th style="width:80vw" scope="col">Access</th>
  </tr>
  <tr>
    <td><code>unauthenticated_read_checkouts</code>,<p><code>unauthenticated_write_checkouts</code></p></td>
    <td><a href="/docs/api/storefront/reference/checkouts/checkout">Checkout</a> object</td>
  </tr>
  <tr>
    <td><code>unauthenticated_read_customers</code>,<p><code>unauthenticated_write_customers</code></p></td>
    <td><a href="/docs/api/storefront/reference/customers/customer">Customer</a> object</td>
  </tr>
  <tr>
    <td><code>unauthenticated_read_customer_tags</code></td>
    <td><code>tags</code> field on the <a href="/docs/api/storefront/reference/customers/customer">Customer</a> object</td>
  </tr>
  <tr>
    <td><code>unauthenticated_read_content</code></td>
    <td>Storefront content, such as <a href="/docs/api/storefront/reference/online-store/article">Article</a>, <a href="/docs/api/storefront/reference/online-store/blog">Blog</a>, and <a href="/docs/api/storefront/reference/online-store/comment">Comment</a> objects</td>
  </tr>
  <tr>
    <td><code>unauthenticated_read_metaobjects</code></td>
    <td>View metaobjects, such as <a href="/docs/api/storefront/latest/objects/metaobject">Metaobject</a></td>
  </tr>
  <tr>
    <td><code>unauthenticated_read_product_inventory</code></td>
    <td><code>quantityAvailable</code> field on the <a href="/docs/api/storefront/reference/products/productvariant">ProductVariant</a> object and <code>totalAvailable</code> field on the <a href="/docs/api/storefront/reference/products/product">Product</a> object</td>
  </tr>
  <tr>
    <td><code>unauthenticated_read_product_listings</code></td>
    <td><a href="/docs/api/storefront/reference/products/product">Product</a> and <a href="/docs/api/storefront/reference/products/collection">Collection</a> objects</td>
  </tr>
  <tr>
    <td><code>unauthenticated_read_product_pickup_locations</code></td>
    <td><a href="/docs/api/storefront/reference/locations/location">Location</a> and <a href="/docs/api/storefront/reference/storeavailability/storeavailability">StoreAvailability</a> objects</td>
  </tr>
  <tr>
    <td><code>unauthenticated_read_product_tags</code></td>
    <td><code>tags</code> field on the <a href="/docs/api/storefront/reference/products/product">Product</a> object</td>
  </tr>
  <tr>
    <td><code>unauthenticated_read_selling_plans</code></td>
    <td>Selling plan content on the <a href="/docs/api/storefront/reference/products">Product</a> object</td>
  </tr>
</table>

## Customer access scopes

Customer access scopes provide apps with read and write access to the [Customer Account API](/docs/api/customer). Customer access is intended for interacting with data that belongs to a customer. For example, an app might need to do one or more of following tasks:

- Read customers orders
- Update customer accounts
- Create and update customer addresses
- Read shop, customer or order metafields

### Request scopes

To request access scopes or permissions for the Headless or Hydrogen channel, refer to [managing permissions](/docs/storefronts/headless/building-with-the-customer-account-api/getting-started#step-2-configure-customer-account-api-access).

{% if feature_flags.schedule_test %}
You can request the following customer access scopes:
{% else %}
Your can request the following customer access scopes:
{% endif %}

<table>
  <caption>Customer access scopes</caption>
  <tr>
    <th style="width:20vw" scope="col">Scope</th>
    <th style="width:80vw" scope="col">Access</th>
  </tr>
  <tr>
    <td><code>customer_read_customers</code>,<p><code>customer_write_customers</code></p></td>
    <td><a href="/docs/api/customer/unstable/objects/PersonalAccount">Customer</a> object</td>
  </tr>
  <tr>
    <td><code>customer_read_orders</code></td>
    <td><a href="/docs/api/customer/unstable/objects/Order">Order</a> object</td>
  </tr>
  <tr>
    <td><code>customer_read_draft_orders</code></td>
    <td><a href="/docs/api/customer/unstable/objects/DraftOrder">Draft Order</a> object</td>
  </tr>
  <tr>
    <td><code>customer_read_markets</code></td>
    <td><a href="/docs/api/customer/unstable/objects/Market">Market</a> object</td>
  </tr>
</table>

## Checking granted access scopes

You can check your app’s granted access scopes using the [GraphQL Admin API](/docs/api/admin-graphql/latest/queries/appInstallation) or [REST Admin API](/docs/api/admin-rest/latest/resources/accessscope).

### GraphQL

{% codeblock file, title: 'POST https://{store_name}.myshopify.com/admin/api/{api_version}/graphql.json' %}

graphql?title: 'GraphQL query'
query {
  appInstallation {
    accessScopes {
      handle
      description
    }
  }
}


json?title: 'JSON response'
{
  "data": {
    "appInstallation": {
      "accessScopes": [
        {
          "handle": "read_products",
          "description": "Read products, variants, and collections"
        },
        {
          "handle": "write_orders",
          "description": "Modify orders, transactions, and fulfillments"
        },
        {
          "handle": "read_orders",
          "description": "Read orders, transactions, and fulfillments"
        },
      ]
    }
  }
}

{% endcodeblock %}

#### REST

{% codeblock %}

html?title: 'REST request'
GET https://{store_name}.myshopify.com/admin/oauth/access_scopes.json


json?title: 'JSON response'
{
  "access_scopes": [
    {
      "handle": "read_products"
    },
    {
      "handle": "write_orders"
    },
    {
      "handle": "read_orders"
    }
  ]
}

{% endcodeblock %}

## Limitations and considerations

- Apps should request only the minimum amount of data that's necessary for an app to function when using a Shopify API. Shopify restricts access to scopes for apps that don't require legitimate use of the associated data.
- Only [public or custom apps](/docs/apps/launch/distribution) are granted access scopes. Legacy app types, such as private or unpublished, won't be granted new access scopes.
`

export const EXAMPLE_SHOPIFY_APP_TOML = `
name = "Example App"
client_id = "a61950a2cbd5f32876b0b55587ec7a27"
application_url = "https://www.app.example.com/"
embedded = true
handle = "example-app"

[access_scopes]
scopes = "read_products"

[access.admin]
direct_api_mode = "online"

[auth]
redirect_urls = [
  "https://app.example.com/api/auth/callback",
  "https://app.example.com/api/auth/oauth/callback",
]

[webhooks]
api_version = "2024-01"
[webhooks.privacy_compliance]
customer_deletion_url = "https://app.example.com/api/webhooks/customer_deletion"
customer_data_request_url = "https://app.example.com/api/webhooks/customer_request"
shop_deletion_url = "https://app.example.com/api/webhooks/deletion"

[app_proxy]
url = "https://app.example.com/api/proxy"
subpath = "store-pickup"
prefix = "apps"

[pos]
embedded = false

[app_preferences]
url = "https://www.app.example.com/preferences"

[build]
automatically_update_urls_on_dev = false
include_config_on_deploy = true
`

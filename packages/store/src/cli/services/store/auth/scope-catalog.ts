export interface ShopifyApiScope {
  value: string
  group: string
  description: string
  // Present on scopes that need protected/Plus/special access; folded into the displayed
  // description so the user sees the caveat before choosing.
  note?: string
}

export const SHOPIFY_API_ACCESS_SCOPES: ReadonlyArray<ShopifyApiScope> = [
  {value: 'write_app_proxy', group: 'App Proxy', description: 'Manage app proxy configuration'},
  {value: 'read_cart_transforms', group: 'Cart Transform', description: 'View cart transform functions'},
  {value: 'write_cart_transforms', group: 'Cart Transform', description: 'Manage cart transform functions'},
  {
    value: 'read_checkout_branding_settings',
    group: 'Checkout',
    description: 'View checkout branding settings',
  },
  {
    value: 'write_checkout_branding_settings',
    group: 'Checkout',
    description: 'Modify checkout branding settings',
  },
  {
    value: 'read_checkout_and_accounts_configurations',
    group: 'Checkout',
    description: 'View checkout and customer account configuration',
  },
  {
    value: 'write_checkout_and_accounts_configurations',
    group: 'Checkout',
    description: 'Modify checkout and customer account configuration',
  },
  {
    value: 'read_content',
    group: 'Content',
    description: 'View store content like articles, blogs, comments, and pages',
  },
  {
    value: 'write_content',
    group: 'Content',
    description: 'Modify store content like articles, blogs, comments, and pages',
  },
  {value: 'read_online_store_pages', group: 'Content', description: 'View Online Store pages'},
  {
    value: 'read_customer_events',
    group: 'Customer Events',
    description: 'View customer behavioral events via the Web Pixel API',
  },
  {value: 'write_pixels', group: 'Customer Events', description: 'Manage web pixels for tracking customer events'},
  {value: 'read_customers', group: 'Customers', description: 'View customer details and customer groups'},
  {value: 'write_customers', group: 'Customers', description: 'Modify customer details and customer groups'},
  {value: 'read_customer_merge', group: 'Customers', description: 'View customer merge previews and requests'},
  {value: 'write_customer_merge', group: 'Customers', description: 'Merge duplicate customer records'},
  {
    value: 'read_customer_data_erasure',
    group: 'Customers',
    description: 'View customer data erasure (redaction) requests',
  },
  {
    value: 'write_customer_data_erasure',
    group: 'Customers',
    description: "Request or cancel erasure of a customer's data",
    note: 'GDPR-related; requires the app to have access to erase customer data.',
  },
  {
    value: 'read_customer_payment_methods',
    group: 'Customers',
    description: "View a customer's stored (vaulted) payment methods",
    note: 'Requires Subscription APIs access approval.',
  },
  {
    value: 'write_customer_payment_methods',
    group: 'Customers',
    description: "Add, import, or revoke a customer's stored payment methods",
  },
  {
    value: 'read_store_credit_accounts',
    group: 'Customers',
    description: 'View customer store credit account balances',
  },
  {
    value: 'read_store_credit_account_transactions',
    group: 'Customers',
    description: 'View store credit account debit/credit transactions',
  },
  {
    value: 'write_store_credit_account_transactions',
    group: 'Customers',
    description: 'Issue or debit store credit account transactions',
  },
  {value: 'read_delivery_customizations', group: 'Delivery', description: 'View delivery customization functions'},
  {
    value: 'write_delivery_customizations',
    group: 'Delivery',
    description: 'Manage delivery customization functions',
  },
  {value: 'read_discounts', group: 'Discounts', description: 'View discounts'},
  {value: 'write_discounts', group: 'Discounts', description: 'Create and modify discounts'},
  {value: 'read_payment_customizations', group: 'Discounts', description: 'View payment customization functions'},
  {
    value: 'write_payment_customizations',
    group: 'Discounts',
    description: 'Manage payment customization functions',
  },
  {
    value: 'read_files',
    group: 'Files',
    description: 'View files uploaded to the store (images, videos, generic files)',
  },
  {value: 'write_files', group: 'Files', description: 'Upload and modify store files'},
  {value: 'read_fulfillments', group: 'Fulfillment', description: 'View fulfillment services'},
  {value: 'write_fulfillments', group: 'Fulfillment', description: 'Modify fulfillment services'},
  {
    value: 'read_assigned_fulfillment_orders',
    group: 'Fulfillment',
    description: "View fulfillment orders assigned to your app's locations",
  },
  {
    value: 'write_assigned_fulfillment_orders',
    group: 'Fulfillment',
    description: "Manage fulfillment orders assigned to your app's locations",
  },
  {
    value: 'read_merchant_managed_fulfillment_orders',
    group: 'Fulfillment',
    description: 'View fulfillment orders at merchant-managed locations',
  },
  {
    value: 'write_merchant_managed_fulfillment_orders',
    group: 'Fulfillment',
    description: 'Manage fulfillment orders at merchant-managed locations',
  },
  {
    value: 'read_third_party_fulfillment_orders',
    group: 'Fulfillment',
    description: "View fulfillment orders at other apps' locations",
  },
  {
    value: 'write_third_party_fulfillment_orders',
    group: 'Fulfillment',
    description: "Manage fulfillment orders at other apps' locations",
    note: 'As of API version 2024-10, order management apps can no longer create fulfillments for fulfillment orders assigned to a different fulfillment service.',
  },
  {
    value: 'read_marketplace_fulfillment_orders',
    group: 'Fulfillment',
    description: 'View fulfillment orders for marketplace sales channels',
  },
  {value: 'read_order_edits', group: 'Fulfillment', description: 'View in-progress order edits'},
  {value: 'write_order_edits', group: 'Fulfillment', description: 'Begin, stage, and commit order edits'},
  {value: 'read_returns', group: 'Fulfillment', description: 'View order returns'},
  {value: 'write_returns', group: 'Fulfillment', description: 'Create and modify order returns'},
  {value: 'read_gift_cards', group: 'Gift Cards', description: 'View gift cards'},
  {value: 'write_gift_cards', group: 'Gift Cards', description: 'Create and modify gift cards'},
  {value: 'read_inventory', group: 'Inventory', description: 'View inventory levels and items'},
  {value: 'write_inventory', group: 'Inventory', description: 'Modify inventory levels and items'},
  {
    value: 'read_legal_policies',
    group: 'Legal',
    description: 'View store legal policies (refund, privacy, terms of service)',
  },
  {value: 'read_locations', group: 'Locations', description: 'View store locations'},
  {value: 'write_locations', group: 'Locations', description: 'Modify store locations'},
  {value: 'read_marketing_events', group: 'Marketing', description: 'View marketing events and activities'},
  {
    value: 'write_marketing_events',
    group: 'Marketing',
    description: 'Create and modify marketing events and activities',
  },
  {value: 'read_markets', group: 'Markets', description: 'View Shopify Markets configuration'},
  {value: 'write_markets', group: 'Markets', description: 'Modify Shopify Markets configuration'},
  {
    value: 'read_merchant_approval_signals',
    group: 'Merchant Approval',
    description: 'View merchant approval signals used to gate app features',
  },
  {value: 'read_metaobjects', group: 'Metaobjects', description: 'View metaobject entries'},
  {value: 'write_metaobjects', group: 'Metaobjects', description: 'Create and modify metaobject entries'},
  {value: 'read_metaobject_definitions', group: 'Metaobjects', description: 'View metaobject definitions'},
  {
    value: 'write_metaobject_definitions',
    group: 'Metaobjects',
    description: 'Create and modify metaobject definitions',
  },
  {
    value: 'read_online_store_navigation',
    group: 'Online Store',
    description: 'View Online Store navigation and URL redirects',
  },
  {
    value: 'write_online_store_navigation',
    group: 'Online Store',
    description: 'Modify Online Store navigation and URL redirects',
  },
  {
    value: 'read_script_tags',
    group: 'Online Store',
    description: 'View script tags that load remote JavaScript on storefront and order status pages',
  },
  {
    value: 'write_script_tags',
    group: 'Online Store',
    description: 'Add and modify script tags that load remote JavaScript on storefront and order status pages',
  },
  {value: 'read_themes', group: 'Online Store', description: 'View theme templates and theme assets'},
  {value: 'write_themes', group: 'Online Store', description: 'Modify theme templates and theme assets'},
  {value: 'read_orders', group: 'Orders', description: 'View orders, transactions, and fulfillments'},
  {value: 'write_orders', group: 'Orders', description: 'Modify orders, transactions, and fulfillments'},
  {
    value: 'read_all_orders',
    group: 'Orders',
    description: 'View all orders, not just those placed in the last 60 days',
    note: 'Requires requesting access from the Partner Dashboard before it can be added to an app.',
  },
  {value: 'read_draft_orders', group: 'Orders', description: 'View draft orders'},
  {value: 'write_draft_orders', group: 'Orders', description: 'Create and modify draft orders'},
  {value: 'read_payment_terms', group: 'Payments', description: 'View payment terms and schedules on orders'},
  {value: 'write_payment_terms', group: 'Payments', description: 'Modify payment terms and schedules on orders'},
  {
    value: 'read_payment_gateways',
    group: 'Payments',
    description: 'View payments app payment gateway configuration',
  },
  {
    value: 'write_payment_gateways',
    group: 'Payments',
    description: 'Modify payments app payment gateway configuration',
  },
  {value: 'read_payment_mandate', group: 'Payments', description: 'View customer payment mandates'},
  {value: 'write_payment_mandate', group: 'Payments', description: 'Modify customer payment mandates'},
  {
    value: 'write_payment_sessions',
    group: 'Payments',
    description: 'Process payment, capture, refund, and void sessions',
    note: 'Payments Apps API — for payment provider apps only.',
  },
  {value: 'read_shopify_payments_disputes', group: 'Payments', description: 'View Shopify Payments disputes'},
  {
    value: 'read_shopify_payments_dispute_evidences',
    group: 'Payments',
    description: 'View Shopify Payments dispute evidence',
  },
  {
    value: 'read_shopify_payments_payouts',
    group: 'Payments',
    description: 'View Shopify Payments payouts and balance transactions',
  },
  {value: 'read_price_rules', group: 'Price Rules', description: 'View price rules'},
  {value: 'write_price_rules', group: 'Price Rules', description: 'Create and modify price rules'},
  {value: 'read_privacy_settings', group: 'Privacy', description: 'View cookie banner and privacy settings'},
  {value: 'write_privacy_settings', group: 'Privacy', description: 'Modify cookie banner and privacy settings'},
  {value: 'read_products', group: 'Products', description: 'View products, variants, and collections'},
  {value: 'write_products', group: 'Products', description: 'Modify products, variants, and collections'},
  {
    value: 'read_product_listings',
    group: 'Products',
    description: 'View which products are published to a given sales channel',
  },
  {
    value: 'read_resource_feedbacks',
    group: 'Products',
    description: 'View app feedback shown to merchants about a product or shop',
  },
  {
    value: 'write_resource_feedbacks',
    group: 'Products',
    description: 'Send app feedback to merchants about a product or shop',
  },
  {
    value: 'read_publications',
    group: 'Publications',
    description: "View sales channel publications and what's published to them",
  },
  {
    value: 'write_publications',
    group: 'Publications',
    description: 'Publish and unpublish resources to sales channels',
  },
  {
    value: 'read_reports',
    group: 'Reports',
    description: 'Run ShopifyQL analytics queries against store data',
    note: "Querying customer-level fields requires meeting Shopify's protected customer data requirements.",
  },
  {value: 'read_shipping', group: 'Shipping', description: 'View shipping rates, countries, and provinces'},
  {value: 'write_shipping', group: 'Shipping', description: 'Modify shipping rates, countries, and provinces'},
  {
    value: 'read_own_subscription_contracts',
    group: 'Subscriptions',
    description: "View your app's own subscription contracts",
    note: 'Requires Subscription APIs access approval.',
  },
  {
    value: 'write_own_subscription_contracts',
    group: 'Subscriptions',
    description: "Modify your app's own subscription contracts",
    note: 'Requires Subscription APIs access approval.',
  },
  {value: 'read_translations', group: 'Translations', description: 'View translated content'},
  {value: 'write_translations', group: 'Translations', description: 'Create and modify translated content'},
  {value: 'read_locales', group: 'Translations', description: 'View locales enabled on the store'},
  {value: 'write_locales', group: 'Translations', description: 'Enable and modify locales on the store'},
  {
    value: 'read_users',
    group: 'Users',
    description: 'View staff member accounts',
    note: 'Shopify Plus/Advanced only; Shopify Support must enable this scope for the app.',
  },
  {value: 'read_validations', group: 'Validations', description: 'View cart and checkout validation functions'},
  {value: 'write_validations', group: 'Validations', description: 'Manage cart and checkout validation functions'},
]

export interface StoreAuthScopeChoice {
  label: string
  value: string
  description: string
  group: string
}

export interface StoreAuthScopeChoices {
  choices: StoreAuthScopeChoice[]
  groupOrder: string[]
}

export function buildStoreAuthScopeChoices(
  catalog: ReadonlyArray<ShopifyApiScope> = SHOPIFY_API_ACCESS_SCOPES,
): StoreAuthScopeChoices {
  const choices = catalog.map((scope) => ({
    label: scope.value,
    value: scope.value,
    group: scope.group,
    description: scope.note ? `${scope.description} (${scope.note})` : scope.description,
  }))

  const groupOrder = [...new Set(catalog.map((scope) => scope.group))].sort()

  return {choices, groupOrder}
}

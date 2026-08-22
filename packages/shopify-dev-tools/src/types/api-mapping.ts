/**
 * API Configuration Mappings
 * This file is the single source of truth for the set of Shopify topics
 * supported by the ai-toolkit. To add a new topic:
 *   1. Add an APIMapping entry to SHOPIFY_APIS.
 *   2. Create src/instructions/<topic>.md.
 * See docs/adding-a-topic.md for the full walkthrough.
 *
 * Type definitions and schemas are in api-types.ts.
 */

import type { APIMapping, PublicPackageEntry } from "./api-types";
import { APICategory, Visibility } from "./api-types";

type APIMappingConfig = Omit<APIMapping<string>, "name"> & {
  /** name is derived from the SHOPIFY_APIS record key. */
  name?: never;
};

function defineApis<const T extends Record<string, APIMappingConfig>>(
  apis: T,
): { readonly [K in keyof T & string]: APIMapping<K> } {
  return Object.fromEntries(
    Object.entries(apis).map(([name, config]) => [name, { name, ...config }]),
  ) as { readonly [K in keyof T & string]: APIMapping<K> };
}

export const SHOPIFY_APIS = defineApis({
  "use-shopify-cli": {
    displayName: "Use Shopify CLI",
    description:
      "Choose when the user needs **Shopify CLI** to run or fix something now: validate app or extension config on disk (`shopify.app.toml`, `shopify.app.<name>.toml`, `shopify.extension.toml`); run or troubleshoot store workflows (`shopify store auth`, `shopify store execute`); or perform explicit store-scoped reads/writes on a named store domain (for example, show/list/find the first 10 products on my store at `foo.myshopify.com`, or inventory and product changes by handle, SKU, or location name). Emphasize **commands and operational steps**, not only authoring GraphQL. Skip for API-only understanding or codegen with no CLI execution, and skip for brand-new merchant asks to start a Shopify store or try Shopify before they have an account. Examples: validate configuration before deploy; run an existing query via CLI; show the first 10 products on `foo.myshopify.com`; missing `shopify store execute`.",
    category: APICategory.EXECUTION,
    visibility: Visibility.PUBLIC,
    searchable: false,
  },

  ucp: {
    displayName: "UCP CLI",
    description:
      'Use when the user wants to use the UCP CLI to find, compare, buy, or track products from online merchants, or to set up and troubleshoot the local UCP profile required for merchant-scoped operations. Covers global catalog search ("find me X under $Y"), named-merchant transactions ("buy this from Z.com"), order tracking, `ucp profile init`, `ucp doctor`, carts, checkout, orders, and UCP setup/help. Falls back to merchant-hosted handoff when direct in-protocol checkout isn\'t available.',
    category: APICategory.EXECUTION,
    visibility: Visibility.PUBLIC,
    searchable: false,
    skillName: "ucp",
    compatibility: "Requires UCP CLI",
    frontmatterExtras: { requires_bin: "ucp", command: "ucp" },
  },

  admin: {
    displayName: "Admin API",
    versioned: true,
    description:
      "Write or explain **Admin GraphQL** queries and mutations for apps and integrations that extend the Shopify admin. Use when the user wants to **understand, design, or generate** the operation itself—even before deciding how to run it. Do **not** choose `admin` first for **app or extension config validation** —use **`use-shopify-cli`**. Do **not** choose `admin` first to **execute** Admin GraphQL **now via Shopify CLI** or for CLI setup/troubleshooting on store workflows—use **`use-shopify-cli`** (store auth/execute, handle/SKU/location lookups, inventory changes).",
    category: APICategory.GRAPHQL,
    visibility: Visibility.PUBLIC,
    schemaSource: { shopifyDevPrefix: "admin" },
    validation: true,
    exampleVectorStoreQuery: {
      query: "productCreate mutation",
      context: "creating a product",
    },
  },

  "storefront-graphql": {
    displayName: "Storefront GraphQL API",
    versioned: true,
    description:
      "Use for custom storefronts requiring direct GraphQL queries/mutations for data fetching and cart operations. Choose this when you need full control over data fetching and rendering your own UI. NOT for Web Components - if the prompt mentions HTML tags like <shopify-store>, <shopify-cart>, use storefront-web-components instead.",
    category: APICategory.GRAPHQL,
    visibility: Visibility.PUBLIC,
    schemaSource: { shopifyDevPrefix: "storefront" },
    validation: true,
    exampleVectorStoreQuery: {
      query: "predictiveSearch query",
      context: "storefront search",
    },
  },

  partner: {
    displayName: "Partner API",
    versioned: true,
    description:
      "The Partner API lets you programmatically access data about your Partner Dashboard, including your apps, themes, and affiliate referrals.",
    category: APICategory.GRAPHQL,
    visibility: Visibility.PUBLIC,
    schemaSource: { shopifyDevPrefix: "partner" },
    validation: true,
    exampleVectorStoreQuery: {
      query: "transactions query",
      context: "partner transaction history",
    },
  },

  customer: {
    displayName: "Customer Account API",
    versioned: true,
    description:
      "The Customer Account API allows customers to access their own data including orders, payment methods, and addresses.",
    category: APICategory.GRAPHQL,
    visibility: Visibility.PUBLIC,
    schemaSource: { shopifyDevPrefix: "customer" },
    validation: true,
    exampleVectorStoreQuery: {
      query: "customer orders query",
      context: "customer order history",
    },
  },

  "payments-apps": {
    displayName: "Payments Apps API",
    versioned: true,
    description:
      "The Payments Apps API enables payment providers to integrate their payment solutions with Shopify's checkout.",
    category: APICategory.GRAPHQL,
    visibility: Visibility.PUBLIC,
    schemaSource: { shopifyDevPrefix: "payments_apps" },
    validation: true,
    exampleVectorStoreQuery: {
      query: "paymentSessionPending mutation",
      context: "pending a payment session",
    },
  },

  functions: {
    displayName: "Shopify Functions",
    versioned: true,
    description:
      "Shopify Functions allow developers to customize the backend logic that powers parts of Shopify. Available APIs: Discount, Cart and Checkout Validation, Cart Transform, Pickup Point Delivery Option Generator, Delivery Customization, Fulfillment Constraints, Local Pickup Delivery Option Generator, Order Routing Location Rule, Payment Customization",
    category: APICategory.FUNCTIONS,
    visibility: Visibility.PUBLIC,
    validation: true,
    exampleVectorStoreQuery: {
      query: "cart transform function input query",
      context: "cart transform function inputs",
    },
  },

  // Function-specific GraphQL APIs for input query validation
  functions_cart_checkout_validation: {
    displayName: "Cart Checkout Validation Function",
    versioned: true,
    description:
      "GraphQL schema for Cart and Checkout Validation Function input queries",
    category: APICategory.FUNCTION_GRAPHQL,
    visibility: Visibility.PUBLIC,
    schemaSource: {
      shopifyDevPrefix: "functions_cart_checkout_validation_schema",
    },
  },

  functions_cart_transform: {
    displayName: "Cart Transform Function",
    versioned: true,
    description: "GraphQL schema for Cart Transform Function input queries",
    category: APICategory.FUNCTION_GRAPHQL,
    visibility: Visibility.PUBLIC,
    schemaSource: { shopifyDevPrefix: "functions_cart_transform_schema" },
  },

  functions_delivery_customization: {
    displayName: "Delivery Customization Function",
    versioned: true,
    description:
      "GraphQL schema for Delivery Customization Function input queries",
    category: APICategory.FUNCTION_GRAPHQL,
    visibility: Visibility.PUBLIC,
    schemaSource: {
      shopifyDevPrefix: "functions_delivery_customization_schema",
    },
  },

  functions_discount: {
    displayName: "Discount Function",
    versioned: true,
    description: "GraphQL schema for Discount Function input queries",
    category: APICategory.FUNCTION_GRAPHQL,
    visibility: Visibility.PUBLIC,
    schemaSource: { shopifyDevPrefix: "functions_discount_schema" },
  },

  functions_discounts_allocator: {
    displayName: "Discounts Allocator Function",
    versioned: true,
    description:
      "GraphQL schema for Discounts Allocator Function input queries",
    category: APICategory.FUNCTION_GRAPHQL,
    visibility: Visibility.PUBLIC,
    schemaSource: { shopifyDevPrefix: "functions_discounts_allocator_schema" },
  },

  functions_fulfillment_constraints: {
    displayName: "Fulfillment Constraints Function",
    versioned: true,
    description:
      "GraphQL schema for Fulfillment Constraints Function input queries",
    category: APICategory.FUNCTION_GRAPHQL,
    visibility: Visibility.PUBLIC,
    schemaSource: {
      shopifyDevPrefix: "functions_fulfillment_constraints_schema",
    },
  },

  functions_local_pickup_delivery_option_generator: {
    displayName: "Local Pickup Delivery Option Generator Function",
    versioned: true,
    description:
      "GraphQL schema for Local Pickup Delivery Option Generator Function input queries",
    category: APICategory.FUNCTION_GRAPHQL,
    visibility: Visibility.PUBLIC,
    schemaSource: {
      shopifyDevPrefix:
        "functions_local_pickup_delivery_option_generator_schema",
    },
  },

  functions_order_discounts: {
    displayName: "Order Discounts Function",
    versioned: true,
    description: "GraphQL schema for Order Discounts Function input queries",
    category: APICategory.FUNCTION_GRAPHQL,
    visibility: Visibility.PUBLIC,
    schemaSource: { shopifyDevPrefix: "functions_order_discounts_schema" },
  },

  functions_order_routing_location_rule: {
    displayName: "Order Routing Location Rule Function",
    versioned: true,
    description:
      "GraphQL schema for Order Routing Location Rule Function input queries",
    category: APICategory.FUNCTION_GRAPHQL,
    visibility: Visibility.PUBLIC,
    schemaSource: {
      shopifyDevPrefix: "functions_order_routing_location_rule_schema",
    },
  },

  functions_payment_customization: {
    displayName: "Payment Customization Function",
    versioned: true,
    description:
      "GraphQL schema for Payment Customization Function input queries",
    category: APICategory.FUNCTION_GRAPHQL,
    visibility: Visibility.PUBLIC,
    schemaSource: {
      shopifyDevPrefix: "functions_payment_customization_schema",
    },
  },

  functions_pickup_point_delivery_option_generator: {
    displayName: "Pickup Point Delivery Option Generator Function",
    versioned: true,
    description:
      "GraphQL schema for Pickup Point Delivery Option Generator Function input queries",
    category: APICategory.FUNCTION_GRAPHQL,
    visibility: Visibility.PUBLIC,
    schemaSource: {
      shopifyDevPrefix:
        "functions_pickup_point_delivery_option_generator_schema",
    },
  },

  functions_product_discounts: {
    displayName: "Product Discounts Function",
    versioned: true,
    description: "GraphQL schema for Product Discounts Function input queries",
    category: APICategory.FUNCTION_GRAPHQL,
    visibility: Visibility.PUBLIC,
    schemaSource: { shopifyDevPrefix: "functions_product_discounts_schema" },
  },

  functions_shipping_discounts: {
    displayName: "Shipping Discounts Function",
    versioned: true,
    description: "GraphQL schema for Shipping Discounts Function input queries",
    category: APICategory.FUNCTION_GRAPHQL,
    visibility: Visibility.PUBLIC,
    schemaSource: { shopifyDevPrefix: "functions_shipping_discounts_schema" },
  },

  "polaris-app-home": {
    displayName: "Polaris App Home",
    description:
      "Build your app's primary user interface embedded in the Shopify admin. If the prompt just mentions `Polaris` and you can't tell based off of the context what API they meant, assume they meant this API.",
    category: APICategory.UI_FRAMEWORK,
    publicPackages: [
      "@shopify/polaris-types",
      "@shopify/app-bridge-types",
      "@shopify/app-bridge-react",
    ],
    visibility: Visibility.PUBLIC,
    validation: true,
    exampleVectorStoreQuery: {
      query: "s-form",
      context: "form in app home",
    },
  },

  "polaris-admin-extensions": {
    displayName: "Polaris Admin Extensions",
    versioned: true,
    description: `Add custom actions and blocks from your app at contextually relevant spots throughout the Shopify Admin. Admin UI Extensions also supports scaffolding new adminextensions using Shopify CLI commands.`,
    category: APICategory.UI_FRAMEWORK,
    publicPackages: [
      "@shopify/ui-extensions",
      // React bindings predate the web-component migration; only valid for
      // the React-era 2025-07 release. Newer versions ship web components
      // and don't support React imports.
      { name: "@shopify/ui-extensions-react", versions: ["2025-07"] },
    ],
    extensionSurfaceName: "admin",
    extensionTypeName: "Admin Extensions",
    extensionSearchContext: "admin UI extensions",
    visibility: Visibility.PUBLIC,
    validation: true,
    exampleVectorStoreQuery: {
      query: "admin.product-details.block.render",
      context: "admin extension target for product details blocks",
    },
    exampleExtensionTarget: "admin.product-details.block.render",
  },

  "polaris-checkout-extensions": {
    displayName: "Polaris Checkout Extensions",
    versioned: true,
    description: `Build custom functionality that merchants can install at defined points in the checkout flow, including product information, shipping, payment, order summary, and Shop Pay. Checkout UI Extensions also supports scaffolding new checkout extensions using Shopify CLI commands.`,
    category: APICategory.UI_FRAMEWORK,
    publicPackages: [
      "@shopify/ui-extensions",
      // React bindings predate the web-component migration; only valid for
      // the React-era 2025-07 release. Newer versions ship web components
      // and don't support React imports.
      { name: "@shopify/ui-extensions-react", versions: ["2025-07"] },
    ],
    extensionSurfaceName: "checkout",
    extensionTypeName: "Checkout Extensions",
    extensionSearchContext: "checkout UI extensions",
    visibility: Visibility.PUBLIC,
    validation: true,
    exampleVectorStoreQuery: {
      query: "s-button checkout",
      context: "checkout button",
    },
    exampleExtensionTarget: "purchase.checkout.block.render",
  },

  "polaris-customer-account-extensions": {
    displayName: "Polaris Customer Account Extensions",
    versioned: true,
    description: `Build custom functionality that merchants can install at defined points on the Order index, Order status, and Profile pages in customer accounts. Customer Account UI Extensions also supports scaffolding new customer account extensions using Shopify CLI commands.`,
    category: APICategory.UI_FRAMEWORK,
    publicPackages: [
      "@shopify/ui-extensions",
      // React bindings predate the web-component migration; only valid for
      // the React-era 2025-07 release. Newer versions ship web components
      // and don't support React imports.
      { name: "@shopify/ui-extensions-react", versions: ["2025-07"] },
    ],
    extensionSurfaceName: "customer-account",
    extensionTypeName: "Customer Account Extensions",
    extensionSearchContext: "customer account UI extensions",
    visibility: Visibility.PUBLIC,
    validation: true,
    exampleVectorStoreQuery: {
      query: "s-card customer-account",
      context: "customer account card",
    },
    exampleExtensionTarget: "customer-account.order-status.block.render",
  },

  "pos-ui": {
    displayName: "POS UI",
    versioned: true,
    description: `Build retail point-of-sale applications using Shopify's POS UI components. These components provide a consistent and familiar interface for POS applications. POS UI Extensions also supports scaffolding new POS extensions using Shopify CLI commands. Keywords: POS, Retail, smart grid`,
    category: APICategory.UI_FRAMEWORK,
    publicPackages: [
      "@shopify/ui-extensions",
      // React bindings predate the web-component migration; only valid for
      // the React-era 2025-07 release. Newer versions ship web components
      // and don't support React imports.
      { name: "@shopify/ui-extensions-react", versions: ["2025-07"] },
    ],
    extensionSurfaceName: "point-of-sale",
    extensionTypeName: "POS UI Extensions",
    extensionSearchContext: "POS UI extensions",
    visibility: Visibility.PUBLIC,
    validation: true,
    exampleVectorStoreQuery: {
      query: "pos.home.tile.render",
      context: "POS home tile extension target",
    },
    exampleExtensionTarget: "pos.customer-details.block.render",
  },

  hydrogen: {
    displayName: "Hydrogen",
    versioned: true,
    description:
      "Hydrogen storefront implementation cookbooks. Some of the available recipes are: B2B Commerce, Bundles, Combined Listings, Custom Cart Method, Dynamic Content with Metaobjects, Express Server, Google Tag Manager Integration, Infinite Scroll, Legacy Customer Account Flow, Markets, Partytown + Google Tag Manager, Subscriptions, Third-party API Queries and Caching. MANDATORY: Use this API for ANY Hydrogen storefront question - do NOT use Storefront GraphQL when 'Hydrogen' is mentioned.",
    category: APICategory.UI_FRAMEWORK,
    publicPackages: ["@shopify/hydrogen"],
    visibility: Visibility.PUBLIC,
    validation: true,
    exampleVectorStoreQuery: {
      query: "CartForm component",
      context: "cart UI",
    },
  },

  "storefront-web-components": {
    displayName: "Storefront Web Components",
    description:
      "HTML-first web components for building storefronts WITHOUT GraphQL. Choose when prompts mention: Web Components, HTML tags (<shopify-store>, <shopify-context>, <shopify-cart>, <shopify-variant-selector>, <shopify-money>), native <dialog>, 'HTML-only', 'without JavaScript', or 'no GraphQL'. Components handle data fetching and state internally.",
    category: APICategory.UI_FRAMEWORK,
    featureFlag: "storefrontWebComponentsEnabled",
    // No publicPackages: storefront web components ship as a CDN script
    // (https://cdn.shopify.com/storefront/web-components.js), not an npm
    // package. validate_component_codeblocks short-circuits this API as
    // UNSUPPORTED_COMPONENT_VALIDATION_API; a future zod-schema validator
    // won't go through loadTypesIntoTSEnv either.
    visibility: Visibility.EARLY_ACCESS,
    validation: true,
    exampleVectorStoreQuery: {
      query: "shopify-cart",
      context: "cart web component",
    },
  },

  liquid: {
    displayName: "Liquid",
    description:
      "Liquid is an open-source templating language created by Shopify. It is the backbone of Shopify themes and is used to load dynamic content on storefronts. Keywords: liquid, theme, shopify-theme, liquid-component, liquid-block, liquid-section, liquid-snippet, liquid-schemas, shopify-theme-schemas",
    category: APICategory.THEME,
    visibility: Visibility.PUBLIC,
    schemaSource: { npmPackage: "@shopify/theme-check-common" },
    validation: true,
    exampleVectorStoreQuery: {
      query: "product metafields",
      context: "product metafield access in a theme",
    },
  },

  "custom-data": {
    displayName: "Custom Data",
    description:
      "MUST be used first when prompts mention Metafields or Metaobjects. Use Metafields and Metaobjects to model and store custom data for your app. Metafields extend built-in Shopify data types like products or customers, Metaobjects are custom data types that can be used to store bespoke data structures. Metafield and Metaobject definitions provide a schema and configuration for values to follow.",
    category: APICategory.CONFIGURATION,
    visibility: Visibility.PUBLIC,
    searchable: false,
  },

  "app-store-review": {
    displayName: "App Store Review",
    description:
      "Run a pre-submission compliance check against your Shopify app's codebase. Reviews App Store requirements and surfaces likely issues before you submit for official review.",
    category: APICategory.GUIDANCE,
    visibility: Visibility.PUBLIC,
    searchable: false,
    compatibility: "Claude Code, Claude Desktop, Cursor",
  },

  "onboarding-dev": {
    displayName: "Developer Onboarding",
    description:
      "Get started building on Shopify. Use when a developer asks to build an app, build a theme, create a dev store, set up a partner account, scaffold a project, or get started developing for Shopify. NOT for merchants managing stores.",
    category: APICategory.GUIDANCE,
    visibility: Visibility.PUBLIC,
    searchable: false,
    compatibility: "Claude Code, Claude Desktop, Cursor",
  },

  "onboarding-merchant": {
    displayName: "Merchant Onboarding",
    description:
      "Set up and connect a Shopify store from your AI assistant. Use when the user wants to start selling online, open a first Shopify store, try Shopify before they have an account, or get merchant-facing next steps after a preview store is created, including how to keep it, save it, or make it real. This is for store owners — not developers. Preview-store creation for brand-new merchants belongs here via `shopify store create preview`; explicit CLI troubleshooting and named-store command execution belong in **`use-shopify-cli`**.",
    category: APICategory.GUIDANCE,
    visibility: Visibility.PUBLIC,
    searchable: false,
    compatibility: "Claude Code, Claude Desktop, Cursor",
    frontmatterExtras: { maintainer: "Shopify" },
  },
});

export type ShopifyAPIs = keyof typeof SHOPIFY_APIS & string;

/**
 * Returns the published skill name for an API.
 * Defaults to the Shopify-prefixed skill directory/name, but allows an API to
 * opt into an established external name when needed.
 */
export function getPublishedSkillName(
  api: Pick<APIMapping<string>, "name" | "skillName">,
): string {
  return api.skillName ?? `shopify-${api.name}`;
}

/**
 * Derives a shopify-dev file prefix → dev-mcp API key mapping from SHOPIFY_APIS.
 * Used by update scripts to avoid maintaining a separate hardcoded SCHEMA_MAP.
 *
 * Returns entries like: { "admin": "admin", "storefront": "storefront-graphql", ... }
 */
export function getShopifyDevSchemaMap(
  apis: Record<string, APIMapping<string>> = SHOPIFY_APIS,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const api of Object.values(apis)) {
    if (api.schemaSource?.shopifyDevPrefix) {
      map[api.schemaSource.shopifyDevPrefix] = api.name;
    }
  }
  return map;
}

/**
 * Returns every topic ID belonging to the given category.
 * Replaces the old per-category grouped constants (GRAPHQL_APIs, TYPESCRIPT_APIs, ...).
 */
export function getApiIdsByCategory(
  category: APICategory,
  apis: Record<string, APIMapping<string>> = SHOPIFY_APIS,
): ShopifyAPIs[] {
  return Object.values(apis)
    .filter((api) => api.category === category)
    .map((api) => api.name as ShopifyAPIs);
}

/**
 * Returns all API IDs that are versioned (have a quarterly release cadence).
 * Used to conditionally add version parameters to tools and skill templates.
 */
export function getVersionedApis(
  apis: Record<string, APIMapping<string>> = SHOPIFY_APIS,
): ShopifyAPIs[] {
  return Object.values(apis)
    .filter((api) => api.versioned === true)
    .map((api) => api.name as ShopifyAPIs);
}

/**
 * Returns true if the given API key represents a versioned API.
 */
export function isVersionedApi(
  apiName: string,
  apis: Record<string, APIMapping<string>> = SHOPIFY_APIS,
): boolean {
  return apis[apiName]?.versioned === true;
}

/**
 * Collects all unique publicPackages across APIs.
 * Used by update scripts to avoid maintaining a hardcoded package list.
 */
export function getPublicPackagesList(
  apis: Record<string, APIMapping<string>> = SHOPIFY_APIS,
): string[] {
  const packages = new Set<string>();
  for (const api of Object.values(apis)) {
    if (api.publicPackages) {
      for (const entry of api.publicPackages) {
        packages.add(getPublicPackageName(entry));
      }
    }
  }
  return [...packages].sort();
}

/**
 * Returns the npm package name from a `publicPackages` entry, whether it's a
 * bare string or a tagged `{ name, versions }` object.
 */
export function getPublicPackageName(entry: PublicPackageEntry): string {
  return typeof entry === "string" ? entry : entry.name;
}

/**
 * Returns true if a `publicPackages` entry applies to the given apiVersion.
 * Bare-string entries always apply. Tagged entries apply when either no
 * `versions` constraint is set or the constraint includes the apiVersion.
 * For unversioned APIs (callers pass `undefined`), constraints are ignored.
 */
export function publicPackageAppliesToVersion(
  entry: PublicPackageEntry,
  apiVersion: string | undefined,
): boolean {
  if (typeof entry === "string") return true;
  if (!entry.versions) return true;
  if (apiVersion === undefined) return true;
  return entry.versions.includes(apiVersion);
}

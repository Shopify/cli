// The set of UI-framework Shopify APIs that `shopify validate components`
// supports, plus the per-API metadata the virtual-TypeScript engine needs.
//
// This is the lean CLI-native slice of the source package's large
// `SHOPIFY_APIS` mapping (config/api-mappings.ts + types/api-mapping.ts). The
// components subcommand only validates the six APIs that ship UI component type
// definitions, so we carry only those entries and only the fields the engine
// reads: which npm packages provide the types, whether the API is versioned,
// and its extension-surface name (for the ui-extensions surface/target loader).
//
// The internal-only and non-component APIs from the source mapping are
// intentionally excluded — they have no bundled component types.

/**
 * An entry in an API's `publicPackages` list. Either a bare npm package name
 * (applies to every version) or a tagged entry scoping the package to a subset
 * of versions — used for React bindings that pre-date the web-component era.
 */
export type PublicPackageEntry = string | {name: string; versions?: string[]}

export interface ComponentApiConfig {
  /** npm packages whose bundled type definitions back this API. */
  publicPackages: PublicPackageEntry[]
  /** Whether the API has a quarterly versioned release cadence. */
  versioned: boolean
  /**
   * Extension-surface name for UI-extension APIs (admin, checkout,
   * customer-account, point-of-sale). Absent for non-extension APIs
   * (polaris-app-home, hydrogen). Its presence also means an extension target
   * is required.
   */
  extensionSurfaceName?: string
}

// Note: the React bindings (`@shopify/ui-extensions-react`) are only valid for
// the React-era 2025-07 release; newer versions ship web components and drop
// React support. The `versions` tag encodes that, matching the source mapping.
const UI_EXTENSION_PACKAGES: PublicPackageEntry[] = [
  '@shopify/ui-extensions',
  {name: '@shopify/ui-extensions-react', versions: ['2025-07']},
]

export const COMPONENT_APIS = {
  'polaris-app-home': {
    publicPackages: ['@shopify/polaris-types', '@shopify/app-bridge-types', '@shopify/app-bridge-react'],
    versioned: false,
  },
  'polaris-admin-extensions': {
    publicPackages: UI_EXTENSION_PACKAGES,
    versioned: true,
    extensionSurfaceName: 'admin',
  },
  'polaris-checkout-extensions': {
    publicPackages: UI_EXTENSION_PACKAGES,
    versioned: true,
    extensionSurfaceName: 'checkout',
  },
  'polaris-customer-account-extensions': {
    publicPackages: UI_EXTENSION_PACKAGES,
    versioned: true,
    extensionSurfaceName: 'customer-account',
  },
  'pos-ui': {
    publicPackages: UI_EXTENSION_PACKAGES,
    versioned: true,
    extensionSurfaceName: 'point-of-sale',
  },
  hydrogen: {
    publicPackages: ['@shopify/hydrogen'],
    versioned: true,
  },
} as const satisfies Record<string, ComponentApiConfig>

export type ComponentApi = keyof typeof COMPONENT_APIS

/** The API identifiers, as a plain string array (for oclif flag `options`). */
export const COMPONENT_API_NAMES = Object.keys(COMPONENT_APIS) as ComponentApi[]

/**
 * Type guard: true when `value` is one of the supported component APIs.
 */
export function isComponentApi(value: string): value is ComponentApi {
  return Object.prototype.hasOwnProperty.call(COMPONENT_APIS, value)
}

/**
 * Returns the npm package name from a `publicPackages` entry, whether it is a
 * bare string or a tagged `{name, versions}` object.
 */
export function getPublicPackageName(entry: PublicPackageEntry): string {
  return typeof entry === 'string' ? entry : entry.name
}

/**
 * Returns true if a `publicPackages` entry applies to the given version.
 * Bare-string entries always apply. Tagged entries apply when they carry no
 * `versions` constraint or the constraint includes the version. For unversioned
 * APIs (callers pass `undefined`), constraints are ignored.
 */
export function publicPackageAppliesToVersion(entry: PublicPackageEntry, apiVersion: string | undefined): boolean {
  if (typeof entry === 'string') return true
  if (!entry.versions) return true
  if (apiVersion === undefined) return true
  return entry.versions.includes(apiVersion)
}

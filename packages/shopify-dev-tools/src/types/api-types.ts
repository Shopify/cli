export const Visibility = {
  PUBLIC: "public",
  EARLY_ACCESS: "earlyAccess",
  INTERNAL: "internal",
} as const;

export type Visibility = (typeof Visibility)[keyof typeof Visibility];

export const APICategory = {
  GRAPHQL: "graphql",
  FUNCTIONS: "functions",
  FUNCTION_GRAPHQL: "function-graphql", // GraphQL schemas for Function input queries
  UI_FRAMEWORK: "ui-framework",
  THEME: "theme",
  CONFIGURATION: "configuration",
  EXECUTION: "execution",
  GUIDANCE: "guidance", // Procedural topics (onboarding, review checklists) — hand-maintained, no validation/search
} as const;

export type APICategory = (typeof APICategory)[keyof typeof APICategory];

/**
 * Entry in an APIMapping's `publicPackages` list. Either a bare npm package
 * name (applies to every supported apiVersion) or a tagged entry that scopes
 * the package to a specific subset of versions. Use the tagged form when a
 * binding is only valid for some quarterly releases — e.g. React bindings
 * that pre-date the web-component migration.
 */
export type PublicPackageEntry =
  | string
  | {
      name: string;
      /**
       * If set, the package is only included in extraction/validation slots
       * whose `apiVersion` appears in this list. Has no effect on unversioned
       * APIs. Use sparingly — most packages apply to every version of the API
       * they're listed under.
       */
      versions?: string[];
    };

export interface SchemaSource {
  /**
   * Filename prefix in shopify-dev's db/data/docs/graphql/raw/ directory.
   * shopify-dev files follow the pattern: `{shopifyDevPrefix}_{version}[_public].json`
   * e.g. "admin" → admin_2026-04.json, "functions_discount_schema" → functions_discount_schema_2026-04_public.json
   */
  shopifyDevPrefix?: string;

  /**
   * npm package that provides schema/validation data for this API.
   * Used for APIs whose schemas are distributed via npm (e.g., theme-check for Liquid).
   * Can be overridden with snapshot/RC versions when testing unreleased functionality.
   */
  npmPackage?: string;
}

export interface APIMapping<TName extends string = string> {
  /** Unique identifier for the API */
  name: TName;

  /** Human-readable display name */
  displayName: string;

  /** Description of what the API does */
  description: string;

  /** Category this API belongs to */
  category: APICategory;

  /** Where the schema for this API is sourced from */
  schemaSource?: SchemaSource;

  /** Feature flag required to enable this API */
  featureFlag?: string;

  /** Optional explicit instructions text for this API */
  instructions?: string;

  publicPackages?: PublicPackageEntry[];

  /** Optional extension surface name used by UI extension APIs */
  extensionSurfaceName?: string;

  /**
   * Pretty type name used in MCP requirements text for extension APIs
   * (e.g. "Admin Extensions", "POS UI Extensions"). When set together with
   * `extensionSearchContext`, the instruction generator emits the extension
   * MCP-requirements block instead of the category-based one.
   */
  extensionTypeName?: string;

  /**
   * Search-context phrase used in MCP requirements text for extension APIs
   * (e.g. "admin UI extensions", "checkout UI extensions").
   */
  extensionSearchContext?: string;

  /** Visibility of this API */
  visibility: Visibility;

  /** Absolute path to the GraphQL introspection schema (.json or .json.gz). */
  gqlSchemaPath?: string;

  /**
   * Schema filename under the resolved data directory. Prefer this over
   * gqlSchemaPath for bundled/internal schemas so the same mapping works from
   * source, package dist, and dev-mcp's bundled dist.
   */
  gqlSchemaFileName?: string;

  /**
   * Whether this API has automated code validation.
   * When true: agent skills include a validate script + mandatory validate instructions;
   * MCP tools include validate guidance; evals assert that the validate tool was called.
   * When false/absent: no validate script, no validate prompt injection, no eval assertion.
   */
  validation?: boolean;

  /**
   * Whether this API has a versioned release cadence (e.g., 2025-04, 2026-01).
   * When true: tools and skills accept a `version` parameter; search forwards
   * api_version to the vector store; skill-blocks emit `--version` guidance.
   * When false/absent: version parameter is not offered for this API.
   *
   * See `NON_VERSIONED_APIS` in `api-mapping.test.ts` for the canonical list.
   */
  versioned?: boolean;

  /**
   * Whether this API's agent skill includes search_docs.js.
   * When false: no search_docs.js is bundled and no search tool calls appear in SKILL.md.
   * Defaults to true when omitted.
   */
  searchable?: boolean;

  /**
   * Override the published skill name/directory.
   * Defaults to `shopify-${name}` when omitted.
   * Use this when the released skill should keep an established external name
   * (for example `ucp`) instead of the Shopify-prefixed default.
   * Published skill names must stay unique across learnable topics;
   * `api-mapping.test.ts` enforces that constraint.
   */
  skillName?: string;

  /**
   * Override for the SKILL.md `compatibility:` frontmatter value.
   * Defaults to "Requires Node.js" when omitted.
   * Use this for skills that ship no Node scripts (e.g. guidance-only) where
   * declaring a Node requirement is misleading.
   */
  compatibility?: string;

  /**
   * Extra top-level SKILL.md frontmatter keys to emit verbatim under `metadata:`'s sibling level.
   * Each entry becomes `key: value` in the output. Example: `{ context: "fork" }` emits
   * `context: fork` — a Claude-Code-specific directive that runs the skill in a forked subagent.
   * Use sparingly for host-specific metadata; prefer built-in fields when possible.
   */
  frontmatterExtras?: Record<string, string>;

  /**
   * Example query for the vector store. Used in SKILL.md and MCP instructions
   * to show agents how to search for this API's documentation.
   *
   * These should demonstrate how to query for an operation or component name
   * (e.g. "inventoryAdjustQuantities mutation"), NOT resemble user-facing
   * prompts used in CI eval smoke tests (e.g. "Fetch the first 20 products").
   */
  exampleVectorStoreQuery?: {
    query: string;
    context: string;
  };

  /**
   * Representative extension target identifier shown in SKILL.md's
   * validate.mjs invocation example. Only meaningful for APIs with
   * `extensionSurfaceName` set, since the validator requires a target for
   * those APIs and the surface-name prefix doesn't always match the target
   * prefix (checkout uses `purchase.*`, point-of-sale uses `pos.*`).
   */
  exampleExtensionTarget?: string;
}

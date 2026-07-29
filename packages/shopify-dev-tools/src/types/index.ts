export enum ValidationResult {
  SUCCESS = "success",
  FAILED = "failed",
  INFORM = "inform",
}

export interface ComponentValidationError {
  property: string;
  message: string;
  expected?: string;
  actual?: string;
}

export interface GenericError {
  message: string;
  code?: number;
  start?: number;
  end?: number;
}

export interface ValidationResponse {
  /**
   * The status of the validation check
   */
  result: ValidationResult;

  /**
   * Explanation of the validation result.
   * For FAILED: Details about why validation failed
   * For SUCCESS: Description of what validation was successfully performed
   * For INFORM: Informational message (e.g., deprecated fields used) - not a failure
   */
  resultDetail: string;

  /**
   * Optional artifact identifier that this validation response relates to.
   * When provided by callers, this allows lineage tracking of validations
   * across revisions of the same artifact.
   */
  artifactId?: string;

  /**
   * Optional artifact revision corresponding to the artifactId. When present,
   * it indicates the revision number used for this validation.
   */
  artifactRevision?: number;

  /**
   * Structured component validation errors. Only includes errors for
   * Shopify components that failed validation, flattened to one entry
   * per error. Present when validation is performed by
   * validateComponentCodeBlock.
   */
  componentValidationErrors?: Array<
    { componentName: string } & ComponentValidationError
  >;

  /**
   * Structured generic TypeScript errors not attributable to a specific
   * component. Present when validation is performed by
   * validateComponentCodeBlock.
   */
  genericErrors?: GenericError[];

  /**
   * Names of components found in the code that were not validated
   * (HTML elements, SVG elements, user-defined components not in the
   * Shopify type definitions). Present when validation is performed by
   * validateComponentCodeBlock.
   */
  unvalidatedComponents?: string[];

  /**
   * Names of Shopify components that were found and validated successfully.
   * Empty when the code compiled cleanly but contained no Shopify components
   * (plain TS, HTML-only, wrapper-only). Callers that need to confirm the
   * block is a complete component artifact — not just a syntactically valid
   * module — should check this is non-empty rather than relying on the
   * top-level result alone.
   */
  validatedComponents?: string[];
}

export type ValidationToolResult = ValidationResponse[];

export interface GraphQLValidationResult {
  /**
   * The validation response containing status and details
   */
  validation: ValidationResponse;

  /**
   * Array of required offline scopes for this operation.
   * Empty array if no scopes are required.
   */
  scopes: string[];
}

export interface APIVersion {
  // Name of the version such as "2025-07"
  name: string;
  latestVersion: boolean;
  // True when the upstream /api-versions.json endpoint flags this version as
  // the release candidate (`rc`). Omitted otherwise.
  releaseCandidate?: boolean;
}

export type APIVersions = APIVersion[];

// Export the source-of-truth topic ID union type
export type { ShopifyAPIs } from "./api-mapping.js";

// Export API types and categories
export {
  APICategory,
  Visibility,
  type APIMapping,
  type PublicPackageEntry,
  type SchemaSource,
} from "./api-types.js";

// Export the API mappings object and helpers
export {
  getApiIdsByCategory,
  getPublicPackageName,
  getPublicPackagesList,
  getShopifyDevSchemaMap,
  getVersionedApis,
  isVersionedApi,
  publicPackageAppliesToVersion,
  SHOPIFY_APIS,
} from "./api-mapping.js";

export {
  getSupportedVersions,
  hasSupportedVersions,
  getLatestVersion,
  resolveVersion,
  isValidVersionFormat,
  SUPPORTED_API_VERSIONS,
  API_VERSION_PATTERN,
  type ResolvedVersion,
  type UnresolvedVersion,
  type VersionResolution,
  type VersionResolutionFailureReason,
  type VersionSource,
  type SupportedVersionsMap,
} from "./api-versions.js";

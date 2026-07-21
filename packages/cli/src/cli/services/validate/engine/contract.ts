// Shared validation contract for `shopify validate <subcommand>`.
//
// This module is the CLI-native port of the source package's
// `types/index.ts` result contract. It is deliberately dependency-free (no
// `graphql`, no `typescript`) so every subcommand — components, functions,
// graphql, theme — can import it without dragging in a validator's heavy
// runtime. Keep it that way.

/**
 * The status of a single validation check.
 *
 * - SUCCESS: the artifact validated cleanly.
 * - FAILED: the artifact is invalid; the command exits non-zero.
 * - INFORM: the artifact is valid but there is something worth surfacing
 *   (e.g. deprecated fields). Treated as a pass for exit-code purposes by the
 *   functions and graphql subcommands. The components validator never emits
 *   INFORM — it only ever returns SUCCESS or FAILED.
 *
 * Modeled as a `const`-object + union rather than a TS `enum`: this is the
 * shape the shared validation foundation settled on (the graphql/functions/theme
 * subcommands all import this same symbol), and it sidesteps the repo's
 * TypeScript enum lint rule. `ValidationResult.FAILED` is still usable as a
 * value, and `ValidationResult` is usable as the `'success' | 'failed' | 'inform'`
 * type, so call sites are unchanged.
 */
export const ValidationResult = {
  SUCCESS: 'success',
  FAILED: 'failed',
  INFORM: 'inform',
} as const

export type ValidationResult = (typeof ValidationResult)[keyof typeof ValidationResult]

export interface ComponentValidationError {
  property: string
  message: string
  expected?: string
  actual?: string
}

export interface GenericError {
  message: string
  code?: number
  start?: number
  end?: number
}

export interface ValidationResponse {
  /** The status of the validation check. */
  result: ValidationResult
  /**
   * Human-readable explanation of the result. For FAILED this is the reason;
   * for SUCCESS/INFORM it describes what was validated. Rendered verbatim as
   * the message body so the markdown stays identical to the source tool.
   */
  resultDetail: string
  /**
   * Optional artifact lineage fields. The CLI subcommands do NOT populate
   * these — the agent-only artifact-id plumbing was intentionally dropped
   * during migration. They remain optional on the type purely so
   * `formatValidationResult` can stay byte-for-byte identical to the source
   * formatter (the artifact block is simply never rendered).
   */
  artifactId?: string
  artifactRevision?: number
  /**
   * Structured component validation errors, flattened to one entry per error.
   * Only populated by the components validator. Present on the JSON payload so
   * machine consumers can inspect per-component failures.
   */
  componentValidationErrors?: ({componentName: string} & ComponentValidationError)[]
  /**
   * Structured generic TypeScript errors not attributable to a specific
   * component. Only populated by the components validator.
   */
  genericErrors?: GenericError[]
  /**
   * Names of components found in the code that were not validated (HTML/SVG
   * elements, user-defined components). Only populated by the components
   * validator.
   */
  unvalidatedComponents?: string[]
  /**
   * Names of Shopify components that were found and validated successfully.
   * Only populated by the components validator.
   */
  validatedComponents?: string[]
}

export type ValidationToolResult = ValidationResponse[]

/**
 * Result of validating a single GraphQL operation, including the offline
 * access scopes the operation would require. `scopes` is empty when none are
 * required or when the schema carries no offline-scope data.
 */
export interface GraphQLValidationResult {
  validation: ValidationResponse
  scopes: string[]
}

/**
 * One entry in the version catalog (`supported-versions-schema.json`). A
 * quarterly version such as `2026-04`, optionally flagged as the default
 * (`latestVersion`) or a release candidate.
 */
export interface ApiVersionEntry {
  name: string
  latestVersion?: boolean
  releaseCandidate?: boolean
}

/** The `api -> versions` catalog shape read from disk. */
export type VersionCatalog = Record<string, ApiVersionEntry[]>

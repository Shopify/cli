import type {ApiVersionEntry, VersionCatalog} from './contract.js'

// Version resolution. CLI-native port of the source `types/api-versions.ts`,
// reframed to operate on a `VersionCatalog` read from disk rather than a
// statically-imported JSON module (the CLI loads the catalog from bundled
// assets at runtime, so it cannot `import` it).

/** How the resolved version was determined — useful for telemetry. */
export type VersionSource = 'explicit' | 'default'

export interface ResolvedVersion {
  ok: true
  /** The resolved version string (e.g. `2026-04`). */
  version: string
  /** How the version was determined. */
  source: VersionSource
  /** The versions the API currently supports. */
  supportedVersions: string[]
}

export type VersionResolutionFailureReason = 'unsupported_version' | 'no_versions'

export interface UnresolvedVersion {
  ok: false
  reason: VersionResolutionFailureReason
  /** The versions the API currently supports (empty when none exist). */
  supportedVersions: string[]
}

export type VersionResolution = ResolvedVersion | UnresolvedVersion

/** API version format pattern: `YYYY-MM` (e.g. `2026-04`) or `unstable`. */
export const API_VERSION_PATTERN = /^\d{4}-\d{2}$|^unstable$/

/**
 * Validates the *format* of a version string. Does not check whether the
 * version is actually supported — use {@link resolveVersion} for that.
 */
export function isValidVersionFormat(version: string): boolean {
  return API_VERSION_PATTERN.test(version)
}

function entriesFor(catalog: VersionCatalog, apiName: string): ApiVersionEntry[] {
  return catalog[apiName] ?? []
}

/** Returns the supported version names for an API, in catalog order. */
export function getSupportedVersions(catalog: VersionCatalog, apiName: string): string[] {
  return entriesFor(catalog, apiName).map((entry) => entry.name)
}

/**
 * Returns the default ("latest") version for an API: the entry flagged
 * `latestVersion`, falling back to the first entry. Undefined if none exist.
 */
export function getLatestVersion(catalog: VersionCatalog, apiName: string): string | undefined {
  const entries = entriesFor(catalog, apiName)
  return entries.find((entry) => entry.latestVersion)?.name ?? entries[0]?.name
}

/**
 * Resolves the version to validate against for an API.
 *
 * - `requested` supplied and supported → `explicit`.
 * - `requested` supplied but not supported → `unsupported_version` failure.
 * - `requested` omitted → the latest version, `default`.
 * - API has no versions → `no_versions` failure.
 */
export function resolveVersion(
  catalog: VersionCatalog,
  apiName: string,
  requested: string | undefined,
): VersionResolution {
  const supportedVersions = getSupportedVersions(catalog, apiName)

  if (supportedVersions.length === 0) {
    return {ok: false, reason: 'no_versions', supportedVersions}
  }

  if (requested) {
    if (supportedVersions.includes(requested)) {
      return {ok: true, version: requested, source: 'explicit', supportedVersions}
    }
    return {ok: false, reason: 'unsupported_version', supportedVersions}
  }

  const latest = getLatestVersion(catalog, apiName)
  if (!latest) {
    return {ok: false, reason: 'no_versions', supportedVersions}
  }

  return {ok: true, version: latest, source: 'default', supportedVersions}
}

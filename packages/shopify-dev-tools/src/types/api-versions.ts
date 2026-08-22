/**
 * Helpers for resolving supported API versions.
 *
 * Reads from supported-versions-schema.json — the single source of truth for
 * which API versions exist and have bundled schemas. SHOPIFY_APIS stays flat
 * and version-agnostic; version data lives in this sibling config.
 */

import type { APIVersion } from "./index.js";
import supportedVersionsJson from "../data/supported-versions-schema.json";

export type SupportedVersionsMap = Record<string, string[]>;

/**
 * Derive a simple string[] map from the richer
 * {name, latestVersion?, releaseCandidate?}[] format. Release candidate
 * versions (entries with `releaseCandidate: true`) are included so developers
 * can opt into them explicitly; they're just not the default — see
 * {@link getLatestVersion}.
 */
const versionEntries = supportedVersionsJson as Record<string, APIVersion[]>;

export const SUPPORTED_API_VERSIONS: SupportedVersionsMap = Object.fromEntries(
  Object.entries(versionEntries)
    .filter(([_, versions]) => versions.length > 0)
    .map(([api, versions]) => [api, versions.map((v) => v.name)]),
);

/**
 * Returns true when the API has an own entry in the supported versions catalog.
 */
export function hasSupportedVersions(apiName: string): boolean {
  return Object.prototype.hasOwnProperty.call(SUPPORTED_API_VERSIONS, apiName);
}

/**
 * The source that determined the resolved version.
 * Used for telemetry — log this to measure how often versions are
 * explicitly specified vs. falling back to default.
 */
export type VersionSource = "explicit" | "default";

export interface ResolvedVersion {
  ok: true;
  /** The resolved version string (e.g. "2026-04") */
  version: string;
  /** How the version was determined */
  source: VersionSource;
  /** Versions the API currently supports. */
  supportedVersions: string[];
}

export type VersionResolutionFailureReason =
  | "unsupported_version"
  | "no_versions";

export interface UnresolvedVersion {
  ok: false;
  /** Why a version could not be resolved. */
  reason: VersionResolutionFailureReason;
  /** Versions the API currently supports. Empty when none are available. */
  supportedVersions: string[];
}

export type VersionResolution = ResolvedVersion | UnresolvedVersion;

/**
 * Returns the supported versions for a given API, or empty array if not versioned.
 */
export function getSupportedVersions(apiName: string): string[] {
  return hasSupportedVersions(apiName) ? SUPPORTED_API_VERSIONS[apiName] : [];
}

/**
 * Returns the latest (default) version for a given API, or undefined if not versioned.
 * "Latest" is the entry marked with `latestVersion: true` in the schema config.
 */
export function getLatestVersion(apiName: string): string | undefined {
  const versions = versionEntries[apiName];
  if (!versions) return undefined;
  return versions.find((v) => v.latestVersion)?.name ?? versions[0]?.name;
}

/**
 * Resolves the version to use for an API.
 *
 * - If `requested` is provided and is a supported version, returns it with source "explicit".
 * - If `requested` is provided but NOT supported, returns a structured "unsupported_version" failure.
 * - If `requested` is omitted/undefined, returns the latest version with source "default".
 * - If the API has no supported versions, returns a structured failure.
 * - If the API is not in the supported versions catalog, throws.
 */
export function resolveVersion(
  apiName: string,
  requested: string | undefined,
): VersionResolution {
  if (!hasSupportedVersions(apiName)) {
    throw new Error(
      `API "${apiName}" is not in the supported versions catalog. ` +
        `Only call resolveVersion for APIs with entries in SUPPORTED_API_VERSIONS.`,
    );
  }

  const supportedVersions = getSupportedVersions(apiName);

  if (supportedVersions.length === 0) {
    return { ok: false, reason: "no_versions", supportedVersions };
  }

  if (requested) {
    if (supportedVersions.includes(requested)) {
      return {
        ok: true,
        version: requested,
        source: "explicit",
        supportedVersions,
      };
    }

    return { ok: false, reason: "unsupported_version", supportedVersions };
  }

  const latest = getLatestVersion(apiName);
  if (!latest) return { ok: false, reason: "no_versions", supportedVersions };

  return { ok: true, version: latest, source: "default", supportedVersions };
}

/**
 * API version format pattern: YYYY-MM (e.g., 2026-04, 2025-01) or "unstable".
 */
export const API_VERSION_PATTERN = /^\d{4}-\d{2}$|^unstable$/;

/**
 * Validates the format of an API version string.
 * Does NOT check if the version is actually supported — use resolveVersion() for that.
 */
export function isValidVersionFormat(version: string): boolean {
  return API_VERSION_PATTERN.test(version);
}

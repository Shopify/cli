import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getSupportedVersions,
  getLatestVersion,
  isValidVersionFormat,
  resolveVersion,
  SUPPORTED_API_VERSIONS,
} from "./api-versions";
import { getVersionedApis } from "./api-mapping";

afterEach(() => {
  vi.doUnmock("../data/supported-versions-schema.json");
});

describe("SUPPORTED_API_VERSIONS config consistency", () => {
  it("every versioned API with serveable versions resolves correctly", () => {
    const versionedApis = getVersionedApis();
    for (const apiName of versionedApis) {
      const versions = SUPPORTED_API_VERSIONS[apiName];
      if (!versions) {
        // Some versioned learnable topics (for example, the Functions overview)
        // do not have their own schema catalog entry.
        expect(() => resolveVersion(apiName, undefined)).toThrow(
          "not in the supported versions catalog",
        );
        continue;
      }

      if (versions.length === 0) {
        // API is versioned but has no schemas bundled yet —
        // resolveVersion should return a structured failure gracefully.
        expect(resolveVersion(apiName, undefined)).toEqual({
          ok: false,
          reason: "no_versions",
          supportedVersions: [],
        });
        continue;
      }
      // Has serveable versions — every entry should be valid format
      for (const version of versions) {
        expect(
          isValidVersionFormat(version),
          `${apiName} has invalid version format: "${version}"`,
        ).toBe(true);
      }
    }
  });

  it("exposes RC versions alongside stable ones", async () => {
    const { default: rawConfig } =
      await import("../data/supported-versions-schema.json");
    const config = rawConfig as Record<
      string,
      { name: string; latestVersion?: boolean; releaseCandidate?: boolean }[]
    >;

    for (const [apiName, entries] of Object.entries(config)) {
      const rcNames = entries
        .filter((e) => e.releaseCandidate)
        .map((e) => e.name);
      const exposed = SUPPORTED_API_VERSIONS[apiName] ?? [];
      for (const rc of rcNames) {
        expect(
          exposed,
          `${apiName} should expose RC version "${rc}"`,
        ).toContain(rc);
      }
    }
  });

  it("treats empty upstream version arrays as missing catalog entries", async () => {
    vi.resetModules();
    vi.doMock("../data/supported-versions-schema.json", () => ({
      default: {
        empty_versioned_api: [],
      },
    }));

    const { resolveVersion, SUPPORTED_API_VERSIONS } =
      await import("./api-versions");

    expect(SUPPORTED_API_VERSIONS).not.toHaveProperty("empty_versioned_api");
    expect(() => resolveVersion("empty_versioned_api", undefined)).toThrow(
      "not in the supported versions catalog",
    );
  });
});

describe("getSupportedVersions", () => {
  it("returns empty array for an unknown API", () => {
    expect(getSupportedVersions("nonexistent")).toEqual([]);
  });

  it("returns multiple versions for APIs with bundled schemas", () => {
    const versions = getSupportedVersions("admin");
    expect(versions.length).toBeGreaterThan(1);
  });

  it("includes unstable for APIs that have it", () => {
    const versions = getSupportedVersions("functions_discounts_allocator");
    expect(versions).toContain("unstable");
  });
});

describe("getLatestVersion", () => {
  it("returns undefined for an unknown API", () => {
    expect(getLatestVersion("nonexistent")).toBeUndefined();
  });

  it("returns the version marked latestVersion for an API", () => {
    // admin has latestVersion: true on a specific entry
    const latest = getLatestVersion("admin");
    expect(latest).toBeDefined();
    expect(isValidVersionFormat(latest!)).toBe(true);
    expect(latest).not.toBe("unstable");
  });

  it("returns the entry marked latestVersion even when it is also a release candidate", async () => {
    vi.resetModules();
    vi.doMock("../data/supported-versions-schema.json", () => ({
      default: {
        rc_latest_api: [
          { name: "2026-01" },
          { name: "2026-04", latestVersion: true, releaseCandidate: true },
        ],
      },
    }));

    const { getLatestVersion } = await import("./api-versions");
    expect(getLatestVersion("rc_latest_api")).toBe("2026-04");
  });
});

describe("resolveVersion", () => {
  it("returns latest with source 'default' when no version requested", () => {
    const result = resolveVersion("admin", undefined);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected version to resolve");
    expect(result.source).toBe("default");
    expect(isValidVersionFormat(result.version)).toBe(true);
    expect(result.supportedVersions).toContain(result.version);
  });

  it("returns requested version with source 'explicit' when supported", () => {
    const latest = getLatestVersion("admin")!;
    const result = resolveVersion("admin", latest);
    expect(result).toEqual({
      ok: true,
      version: latest,
      source: "explicit",
      supportedVersions: getSupportedVersions("admin"),
    });
  });

  it("returns supported versions when requested version is not supported", () => {
    const result = resolveVersion("admin", "2010-01");
    expect(result).toEqual({
      ok: false,
      reason: "unsupported_version",
      supportedVersions: getSupportedVersions("admin"),
    });
  });

  it("throws for an unknown API with no request", () => {
    expect(() => resolveVersion("nonexistent", undefined)).toThrow(
      "not in the supported versions catalog",
    );
  });

  it("throws for an unknown API with a request", () => {
    expect(() => resolveVersion("nonexistent", "2026-04")).toThrow(
      "not in the supported versions catalog",
    );
  });

  it("does not treat inherited object properties as supported APIs", () => {
    expect(getSupportedVersions("toString")).toEqual([]);
    expect(() => resolveVersion("toString", undefined)).toThrow(
      "not in the supported versions catalog",
    );
  });

  it("throws when a version is requested for a non-versioned API", () => {
    expect(() => resolveVersion("liquid", "2026-04")).toThrow(
      "not in the supported versions catalog",
    );
  });

  it("resolves unstable when explicitly requested", () => {
    const result = resolveVersion("functions_discounts_allocator", "unstable");
    expect(result).toEqual({
      ok: true,
      version: "unstable",
      source: "explicit",
      supportedVersions: getSupportedVersions("functions_discounts_allocator"),
    });
  });

  it("resolves a release candidate version when explicitly requested", async () => {
    const { default: rawConfig } =
      await import("../data/supported-versions-schema.json");
    const config = rawConfig as Record<
      string,
      { name: string; latestVersion?: boolean; releaseCandidate?: boolean }[]
    >;

    const [apiName, rcEntry] =
      Object.entries(config)
        .map(
          ([name, entries]) =>
            [name, entries.find((e) => e.releaseCandidate)] as const,
        )
        .find(([, rc]) => rc !== undefined) ?? [];

    if (!apiName || !rcEntry) {
      throw new Error(
        "expected at least one API in the schema to advertise a release candidate",
      );
    }

    const result = resolveVersion(apiName, rcEntry.name);
    expect(result).toEqual({
      ok: true,
      version: rcEntry.name,
      source: "explicit",
      supportedVersions: getSupportedVersions(apiName),
    });
    expect(result.supportedVersions).toContain(rcEntry.name);
  });
});

describe("isValidVersionFormat", () => {
  it("accepts YYYY-MM format", () => {
    expect(isValidVersionFormat("2026-04")).toBe(true);
  });

  it("accepts 'unstable'", () => {
    expect(isValidVersionFormat("unstable")).toBe(true);
  });

  it("rejects invalid formats", () => {
    expect(isValidVersionFormat("latest")).toBe(false);
    expect(isValidVersionFormat("2026")).toBe(false);
    expect(isValidVersionFormat("26-04")).toBe(false);
    expect(isValidVersionFormat("2026-4")).toBe(false);
    expect(isValidVersionFormat("")).toBe(false);
    expect(isValidVersionFormat("2026-04-01")).toBe(false);
  });
});

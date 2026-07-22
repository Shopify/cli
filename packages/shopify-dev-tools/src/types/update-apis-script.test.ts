import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface IsolatedDataDirOptions {
  supportedVersions?: Record<
    string,
    { name: string; latestVersion?: boolean; releaseCandidate?: boolean }[]
  >;
  /** Extra files to seed (path relative to data dir → contents) */
  extras?: Record<string, string>;
}

/**
 * Create an isolated data directory for update-apis tests to avoid corrupting
 * the real src/data directory which is read by concurrent test workers.
 * The UPDATE_APIS_DATA_DIR env var redirects the script's DATA_DIR.
 */
function makeIsolatedDataDir(opts: IsolatedDataDirOptions = {}) {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "update-apis-data-"));
  if (opts.supportedVersions) {
    writeFileSync(
      path.join(dataDir, "supported-versions-schema.json"),
      JSON.stringify(opts.supportedVersions),
    );
  }
  for (const [name, contents] of Object.entries(opts.extras ?? {})) {
    writeFileSync(path.join(dataDir, name), contents);
  }
  return dataDir;
}

function makeRawSchemaDir(adminVersions: string[] = []) {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "update-apis-test-"));
  const rawDir = path.join(tmpDir, "db/data/docs/graphql/raw");
  mkdirSync(rawDir, { recursive: true });
  for (const v of adminVersions) {
    writeFileSync(path.join(rawDir, `admin_${v}.json`), "{}");
  }
  return { tmpDir, rawDir };
}

const ROOT_DIR = path.resolve(import.meta.dirname, "../..");

function runScript(
  args: string,
  dataDir: string,
  extraEnv: Record<string, string> = {},
) {
  try {
    return execSync(`node scripts/update-apis.mjs ${args} 2>&1`, {
      cwd: ROOT_DIR,
      encoding: "utf-8",
      stdio: "pipe",
      env: { ...process.env, UPDATE_APIS_DATA_DIR: dataDir, ...extraEnv },
    });
  } catch (e) {
    // The script may exit non-zero (e.g. compress-json operates on the real
    // src/data dir, offline-scopes generator missing in the tmp shopify-dev).
    // Tests assert against the captured output and the on-disk state regardless.
    const err = e as { stdout?: string; stderr?: string };
    return (err.stdout ?? "") + (err.stderr ?? "");
  }
}

/**
 * Build a fake-npm fixture directory that satisfies the script's network
 * lookups in `UPDATE_APIS_FAKE_NPM_DIR` mode.
 *
 * Each package gets a dist-tags.json + version subdirectories with at least a
 * package.json. The script's extractor walks the version dir for .d.ts files
 * (or the dist/ subdir per recipe) and copies them out.
 */
function makeFakeNpmDir(
  packages: Record<
    string,
    {
      distTags: Record<string, string>;
      versions: Record<
        string,
        { packageJson?: object; files?: Record<string, string> }
      >;
    }
  >,
) {
  const root = mkdtempSync(path.join(os.tmpdir(), "fake-npm-"));
  for (const [pkg, spec] of Object.entries(packages)) {
    const pkgRoot = path.join(root, pkg);
    mkdirSync(pkgRoot, { recursive: true });
    writeFileSync(
      path.join(pkgRoot, "dist-tags.json"),
      JSON.stringify(spec.distTags),
    );
    for (const [version, payload] of Object.entries(spec.versions)) {
      const verRoot = path.join(pkgRoot, version);
      mkdirSync(verRoot, { recursive: true });
      writeFileSync(
        path.join(verRoot, "package.json"),
        JSON.stringify(payload.packageJson ?? { name: pkg, version }),
      );
      for (const [relPath, contents] of Object.entries(payload.files ?? {})) {
        const filePath = path.join(verRoot, relPath);
        mkdirSync(path.dirname(filePath), { recursive: true });
        writeFileSync(filePath, contents);
      }
    }
  }
  return root;
}

// Pinned @types/react version in ALWAYS_LOADED_TYPE_PACKAGES (script side).
// Kept here so the fake-npm fixture publishes the same version the script
// resolves to, regardless of what `latest` says.
const TYPES_REACT_PINNED_VERSION = "18.3.29";

// All extraction kinds touch the always-loaded packages and polaris-app-home
// packages (unversioned, always at latest unless pinned). Centralise their
// fixtures. @types/react publishes `latest` deliberately *outside* the pin
// range (19.x) so tests prove the pin overrides the dist-tag.
const ALWAYS_LOADED_FIXTURES = {
  preact: {
    distTags: { latest: "10.0.0" },
    versions: { "10.0.0": { files: { "preact.d.ts": "export {};" } } },
  },
  "@types/react": {
    distTags: { latest: "19.0.0" },
    versions: {
      "19.0.0": { files: { "index.d.ts": "export {};" } },
      [TYPES_REACT_PINNED_VERSION]: {
        files: { "index.d.ts": "export {};" },
      },
    },
  },
  "@shopify/polaris-types": {
    distTags: { latest: "1.0.7" },
    versions: {
      "1.0.7": { files: { "dist/polaris.d.ts": "export {};" } },
    },
  },
  "@shopify/app-bridge-types": {
    distTags: { latest: "0.7.0" },
    versions: { "0.7.0": { files: { "dist/index.d.ts": "export {};" } } },
  },
  "@shopify/app-bridge-react": {
    distTags: { latest: "4.2.10" },
    versions: {
      "4.2.10": {
        files: { "build/types/esm/index.d.ts": "export {};" },
      },
    },
  },
};

// All UI-extensions APIs (admin/checkout/customer-account/pos) now also
// extract @shopify/ui-extensions-react at the pinned version in
// update-apis.mjs's PACKAGE_EXTRACTION_RECIPES, plus the @remote-ui/* and
// @types/react-reconciler transitive closure its .d.ts files reference. Keep
// this fixture aligned with the recipe so tests don't have to know the
// pinned/transitive versions.
const UI_EXTENSIONS_REACT_PINNED_VERSION = "2025.7.4";
// Expected versions per transitive dep after the script runs. The first two
// are direct deps of @shopify/ui-extensions-react and are resolved via the
// parent's declared range; the remaining four are deeper deps the script
// pins explicitly in PACKAGE_EXTRACTION_RECIPES because they aren't in the
// parent's package.json (so resolveSemverRange has nothing to honor). The
// fake-npm fixture below publishes a deliberately *higher* `latest` for the
// pinned deps so tests prove the pin wins.
const UI_EXTENSIONS_REACT_TRANSITIVE_VERSIONS = {
  "@remote-ui/react": "5.0.6",
  "@remote-ui/async-subscription": "2.1.16",
  "@remote-ui/core": "2.2.7",
  "@remote-ui/rpc": "1.4.7",
  "@remote-ui/types": "1.1.3",
  "@types/react-reconciler": "0.28.9",
};
// Pinned-dep fixtures publish both the pinned version and a much newer
// "latest" that would land in the index if the pin weren't honored. Direct
// deps (the first two) only publish the version their parent's range
// resolves to.
const UI_EXTENSIONS_REACT_PINNED_TRANSITIVE_DEPS = new Set([
  "@remote-ui/core",
  "@remote-ui/rpc",
  "@remote-ui/types",
  "@types/react-reconciler",
]);
const UI_EXTENSIONS_REACT_FIXTURE = {
  "@shopify/ui-extensions-react": {
    distTags: { latest: UI_EXTENSIONS_REACT_PINNED_VERSION },
    versions: {
      [UI_EXTENSIONS_REACT_PINNED_VERSION]: {
        packageJson: {
          name: "@shopify/ui-extensions-react",
          version: UI_EXTENSIONS_REACT_PINNED_VERSION,
          // Only the first two transitive deps are declared in the parent
          // package.json (so resolveSemverRange honors the range). The rest
          // are deeper than expandPackageExtraction looks and rely on the
          // explicit pin in PACKAGE_EXTRACTION_RECIPES.
          dependencies: {
            "@remote-ui/react": "^5.0.6",
            "@remote-ui/async-subscription": "^2.1.16",
          },
        },
        files: {
          "build/ts/surfaces/admin/Foo.d.ts": "export {};",
          "build/ts/surfaces/checkout/Bar.d.ts": "export {};",
          "build/ts/surfaces/customer-account/Baz.d.ts": "export {};",
          "build/ts/surfaces/point-of-sale/Qux.d.ts": "export {};",
        },
      },
    },
  },
  ...Object.fromEntries(
    Object.entries(UI_EXTENSIONS_REACT_TRANSITIVE_VERSIONS).map(
      ([pkg, version]) => {
        const isPinned = UI_EXTENSIONS_REACT_PINNED_TRANSITIVE_DEPS.has(pkg);
        // Out-of-range "latest" for pinned deps — anything newer than the
        // pin works as long as it's clearly outside any plausible declared
        // range. The test asserts the script ignores this in favor of the
        // pinned version.
        const decoyLatest = isPinned ? "99.0.0" : version;
        const versions = {
          [version]: { files: { "index.d.ts": "export {};" } },
        };
        if (isPinned) {
          versions[decoyLatest] = { files: { "index.d.ts": "export {};" } };
        }
        return [pkg, { distTags: { latest: decoyLatest }, versions }];
      },
    ),
  ),
};

// supported-versions stub that lists nothing for any UI API. Each test fills
// in just the keys it cares about.
function emptyUiSupportedVersions() {
  return {
    "polaris-admin-extensions": [],
    "polaris-checkout-extensions": [],
    "polaris-customer-account-extensions": [],
    "pos-ui": [],
    "polaris-app-home": [],
    "storefront-web-components": [],
    hydrogen: [],
  };
}

describe("scripts/update-apis.mjs CLI", () => {
  describe("--help flag", () => {
    it("prints usage and exits 0", () => {
      const output = execSync("node scripts/update-apis.mjs --help", {
        cwd: ROOT_DIR,
        encoding: "utf-8",
      });
      expect(output).toContain("Usage: node scripts/update-apis.mjs");
      expect(output).toContain("--version");
      expect(output).toContain("--shopify-dev");
      expect(output).toContain("--snapshot");
      expect(output).toContain("--schemas-only");
      expect(output).toContain("--internal");
      expect(output).toContain("--yes");
      expect(output).toContain("--skip-versions");
      expect(output).toContain("--types-only");
    });
  });

  describe("unknown argument", () => {
    it("exits with code 1", () => {
      expect(() =>
        execSync("node scripts/update-apis.mjs --bogus", {
          cwd: ROOT_DIR,
          encoding: "utf-8",
          stdio: "pipe",
        }),
      ).toThrow();
    });
  });

  describe("schema detection", () => {
    it("errors when shopify-dev path does not exist", () => {
      expect(() =>
        execSync(
          "node scripts/update-apis.mjs --shopify-dev /nonexistent/path --schemas-only -y",
          { cwd: ROOT_DIR, encoding: "utf-8", stdio: "pipe" },
        ),
      ).toThrow();
    });

    it("errors when raw schema directory is missing", () => {
      const tmpDir = mkdtempSync(path.join(os.tmpdir(), "update-apis-test-"));

      expect(() =>
        execSync(
          `node scripts/update-apis.mjs --shopify-dev ${tmpDir} --schemas-only -y`,
          { cwd: ROOT_DIR, encoding: "utf-8", stdio: "pipe" },
        ),
      ).toThrow();
    });

    it("copies every admin version listed in supported-versions-schema.json", () => {
      const { tmpDir } = makeRawSchemaDir(["2025-07", "2026-04", "unstable"]);
      const dataDir = makeIsolatedDataDir({
        supportedVersions: {
          admin: [
            { name: "2026-04", latestVersion: true },
            { name: "2025-07" },
          ],
        },
      });

      runScript(
        `--shopify-dev ${tmpDir} --schemas-only --skip-versions -y`,
        dataDir,
      );

      // Both versions should land in the data dir as uncompressed JSON
      // (compress-json runs against the real src/data, not the tmp dir).
      expect(existsSync(path.join(dataDir, "admin_2026-04.json"))).toBe(true);
      expect(existsSync(path.join(dataDir, "admin_2025-07.json"))).toBe(true);
    });

    it("--schemas-only does not refresh supported versions", () => {
      const { tmpDir } = makeRawSchemaDir(["2026-04"]);
      const dataDir = makeIsolatedDataDir({
        supportedVersions: {
          admin: [{ name: "2026-04", latestVersion: true }],
        },
      });

      const output = runScript(
        `--shopify-dev ${tmpDir} --schemas-only -y`,
        dataDir,
      );

      expect(output).not.toContain(
        "Part 0: Build supported-versions-schema.json",
      );
      expect(output).not.toContain(
        "Fetching https://shopify.dev/api-versions.json",
      );
      expect(existsSync(path.join(dataDir, "admin_2026-04.json"))).toBe(true);
    });

    it("--version override copies only that version", () => {
      const { tmpDir } = makeRawSchemaDir(["2025-07", "2026-04"]);
      const dataDir = makeIsolatedDataDir({
        supportedVersions: {
          admin: [
            { name: "2026-04", latestVersion: true },
            { name: "2025-07" },
          ],
        },
      });

      runScript(
        `--shopify-dev ${tmpDir} --version 2025-07 --schemas-only --skip-versions -y`,
        dataDir,
      );

      expect(existsSync(path.join(dataDir, "admin_2025-07.json"))).toBe(true);
      // Catalog-listed 2026-04 should NOT be copied in single-version mode
      expect(existsSync(path.join(dataDir, "admin_2026-04.json"))).toBe(false);
    });

    it("--version copies a release-candidate when the catalog lists it", () => {
      const { tmpDir } = makeRawSchemaDir(["2026-04-rc"]);
      const dataDir = makeIsolatedDataDir({
        supportedVersions: {
          admin: [{ name: "2026-04-rc", releaseCandidate: true }],
        },
      });

      runScript(
        `--shopify-dev ${tmpDir} --version 2026-04-rc --schemas-only --skip-versions -y`,
        dataDir,
      );

      expect(existsSync(path.join(dataDir, "admin_2026-04-rc.json"))).toBe(
        true,
      );
    });

    it("--version warns and skips APIs that don't list the requested version", () => {
      const { tmpDir } = makeRawSchemaDir(["2026-04"]);
      const dataDir = makeIsolatedDataDir({
        supportedVersions: {
          admin: [{ name: "2026-04", latestVersion: true }],
        },
      });

      const output = runScript(
        `--shopify-dev ${tmpDir} --version 2099-01 --schemas-only --skip-versions -y`,
        dataDir,
      );

      expect(output).toContain(
        "admin: 2099-01 not in supported-versions-schema.json",
      );
      expect(output).toContain("listed: 2026-04");
      expect(existsSync(path.join(dataDir, "admin_2099-01.json"))).toBe(false);
    });

    it("--version warns and skips when source is missing on disk", () => {
      // Catalog lists 2099-01 for admin, but shopify-dev doesn't have the file.
      // Single-version mode is lenient — warn and skip rather than fail.
      const { tmpDir } = makeRawSchemaDir([]);
      const dataDir = makeIsolatedDataDir({
        supportedVersions: {
          admin: [{ name: "2099-01", latestVersion: true }],
        },
      });

      const output = runScript(
        `--shopify-dev ${tmpDir} --version 2099-01 --schemas-only --skip-versions -y`,
        dataDir,
      );

      expect(output).toContain("No source on disk for admin@2099-01");
      expect(existsSync(path.join(dataDir, "admin_2099-01.json"))).toBe(false);
    });

    it("fails in catalog mode when shopify-dev is missing a listed version", () => {
      const { tmpDir } = makeRawSchemaDir(["2026-04"]);
      const dataDir = makeIsolatedDataDir({
        supportedVersions: {
          admin: [
            { name: "2026-04", latestVersion: true },
            { name: "2025-07" },
          ],
        },
      });

      const output = runScript(
        `--shopify-dev ${tmpDir} --schemas-only --skip-versions -y`,
        dataDir,
      );

      expect(output).toContain("No source schema found for admin@2025-07");
      expect(existsSync(path.join(dataDir, "admin_2025-07.json"))).toBe(false);
      expect(existsSync(path.join(dataDir, "admin_2026-04.json"))).toBe(false);
    });

    it("copies releaseCandidate-flagged versions in catalog mode", () => {
      const { tmpDir } = makeRawSchemaDir(["2026-04", "2026-07-preview"]);
      const dataDir = makeIsolatedDataDir({
        supportedVersions: {
          admin: [
            { name: "2026-07-preview", releaseCandidate: true },
            { name: "2026-04", latestVersion: true },
          ],
        },
      });

      runScript(
        `--shopify-dev ${tmpDir} --schemas-only --skip-versions -y`,
        dataDir,
      );

      expect(existsSync(path.join(dataDir, "admin_2026-04.json"))).toBe(true);
      expect(existsSync(path.join(dataDir, "admin_2026-07-preview.json"))).toBe(
        true,
      );
    });

    it("deletes admin schemas no longer in the catalog", () => {
      const { tmpDir } = makeRawSchemaDir(["2026-04"]);
      const dataDir = makeIsolatedDataDir({
        supportedVersions: {
          admin: [{ name: "2026-04", latestVersion: true }],
        },
        // Pre-existing schema file for a version that's no longer supported
        extras: { "admin_2024-01.json.gz": "stale-bytes" },
      });

      runScript(
        `--shopify-dev ${tmpDir} --schemas-only --skip-versions -y`,
        dataDir,
      );

      expect(existsSync(path.join(dataDir, "admin_2024-01.json.gz"))).toBe(
        false,
      );
      expect(existsSync(path.join(dataDir, "admin_2026-04.json"))).toBe(true);
    });
  });

  describe("--types-only UI type asset extraction", () => {
    it("extracts ui-extensions surface files per (apiKey, apiVersion) and writes index.json", () => {
      const supportedVersions = {
        ...emptyUiSupportedVersions(),
        "polaris-admin-extensions": [
          { name: "2026-04", latestVersion: true },
          { name: "2026-01" },
        ],
        "polaris-checkout-extensions": [
          { name: "2026-04", latestVersion: true },
        ],
      };
      const dataDir = makeIsolatedDataDir({ supportedVersions });
      const fakeNpm = makeFakeNpmDir({
        ...ALWAYS_LOADED_FIXTURES,
        ...UI_EXTENSIONS_REACT_FIXTURE,
        "@shopify/ui-extensions": {
          distTags: {
            "2026-04": "2026.4.2",
            "2026-01": "2026.1.3",
            latest: "2026.4.2",
          },
          versions: {
            "2026.4.2": {
              files: {
                "build/ts/surfaces/admin/Foo.d.ts": "export {};",
                "build/ts/surfaces/checkout/Bar.d.ts": "export {};",
                // Sibling entry-point .d.ts files referenced by `typesVersions`
                // / `exports.types` — pulled in via the tuple form of
                // surfaceSubpath. Without these TypeScript can't resolve
                // `import ... from '@shopify/ui-extensions/admin'`.
                "build/ts/surfaces/admin.d.ts": "export {};",
                "build/ts/surfaces/checkout.d.ts": "export {};",
                // Top-level entry-point .d.ts files at build/ts/*.d.ts —
                // pulled in via shallowSubpaths.
                "build/ts/extension.d.ts": "export {};",
                "build/ts/index.d.ts": "export {};",
                // Nested file under build/ts/ that the shallow walk MUST NOT
                // pull in (asserted below).
                "build/ts/docs/Internal.d.ts": "export {};",
              },
            },
            "2026.1.3": {
              files: {
                "build/ts/surfaces/admin/Foo.d.ts": "export {};",
                "build/ts/surfaces/admin.d.ts": "export {};",
                "build/ts/extension.d.ts": "export {};",
              },
            },
          },
        },
      });

      runScript("--types-only --skip-versions -y", dataDir, {
        UPDATE_APIS_FAKE_NPM_DIR: fakeNpm,
      });

      // The shared 2026.4.2 dir holds both surfaces (admin+checkout) because
      // both APIs map to it; 2026.1.3 only holds admin because only the admin
      // API requested it.
      expect(
        existsSync(
          path.join(
            dataDir,
            "types/@shopify/ui-extensions/2026.4.2/build/ts/surfaces/admin/Foo.d.ts",
          ),
        ),
      ).toBe(true);
      expect(
        existsSync(
          path.join(
            dataDir,
            "types/@shopify/ui-extensions/2026.4.2/build/ts/surfaces/checkout/Bar.d.ts",
          ),
        ),
      ).toBe(true);
      expect(
        existsSync(
          path.join(
            dataDir,
            "types/@shopify/ui-extensions/2026.1.3/build/ts/surfaces/admin/Foo.d.ts",
          ),
        ),
      ).toBe(true);
      // 2026.1.3 should not carry the checkout surface — no API mapped to it.
      expect(
        existsSync(
          path.join(
            dataDir,
            "types/@shopify/ui-extensions/2026.1.3/build/ts/surfaces/checkout/Bar.d.ts",
          ),
        ),
      ).toBe(false);

      // Sibling `<surface>.d.ts` entry-point files (tuple form of
      // surfaceSubpath) must land — copyExtractedFiles silently skips
      // missing paths, so without these assertions the tuple code path
      // could regress unnoticed.
      expect(
        existsSync(
          path.join(
            dataDir,
            "types/@shopify/ui-extensions/2026.4.2/build/ts/surfaces/admin.d.ts",
          ),
        ),
      ).toBe(true);
      expect(
        existsSync(
          path.join(
            dataDir,
            "types/@shopify/ui-extensions/2026.4.2/build/ts/surfaces/checkout.d.ts",
          ),
        ),
      ).toBe(true);
      expect(
        existsSync(
          path.join(
            dataDir,
            "types/@shopify/ui-extensions/2026.1.3/build/ts/surfaces/admin.d.ts",
          ),
        ),
      ).toBe(true);

      // Top-level entry-point .d.ts files at build/ts/*.d.ts (shallowSubpaths)
      // must land for both shared versions.
      expect(
        existsSync(
          path.join(
            dataDir,
            "types/@shopify/ui-extensions/2026.4.2/build/ts/extension.d.ts",
          ),
        ),
      ).toBe(true);
      expect(
        existsSync(
          path.join(
            dataDir,
            "types/@shopify/ui-extensions/2026.4.2/build/ts/index.d.ts",
          ),
        ),
      ).toBe(true);
      expect(
        existsSync(
          path.join(
            dataDir,
            "types/@shopify/ui-extensions/2026.1.3/build/ts/extension.d.ts",
          ),
        ),
      ).toBe(true);

      // shallowSubpaths must NOT recurse — nested files under build/ts/
      // (e.g. docs/) should stay behind.
      expect(
        existsSync(
          path.join(
            dataDir,
            "types/@shopify/ui-extensions/2026.4.2/build/ts/docs/Internal.d.ts",
          ),
        ),
      ).toBe(false);

      const index = JSON.parse(
        readFileSync(path.join(dataDir, "types/index.json"), "utf-8"),
      );
      // Surface-version mapping. @shopify/ui-extensions-react is scoped to
      // 2025-07 only in api-mapping.ts, so it MUST NOT appear here — the
      // version-scoping coverage lives in the dedicated test below. Use
      // `.toContainEqual` for the positive checks since the slot also carries
      // the always-loaded packages.
      expect(index["polaris-admin-extensions"]["2026-04"]).toContainEqual({
        package: "@shopify/ui-extensions",
        version: "2026.4.2",
      });
      expect(index["polaris-admin-extensions"]["2026-01"]).toContainEqual({
        package: "@shopify/ui-extensions",
        version: "2026.1.3",
      });
      expect(index["polaris-checkout-extensions"]["2026-04"]).toContainEqual({
        package: "@shopify/ui-extensions",
        version: "2026.4.2",
      });
      expect(index._always_loaded).toContainEqual({
        package: "preact",
        version: "10.0.0",
      });
    });

    it("resolves @shopify/ui-extensions-react transitive deps and includes them in the index", () => {
      // React bindings are scoped to 2025-07 in api-mapping.ts, so the
      // transitive-dep test must target a version slot where React actually
      // appears. 2026-04 is exercised by the surface-extraction test above
      // (which now asserts React is absent for that slot).
      const supportedVersions = {
        ...emptyUiSupportedVersions(),
        "polaris-admin-extensions": [{ name: "2025-07", latestVersion: true }],
      };
      const dataDir = makeIsolatedDataDir({ supportedVersions });
      const fakeNpm = makeFakeNpmDir({
        ...ALWAYS_LOADED_FIXTURES,
        ...UI_EXTENSIONS_REACT_FIXTURE,
        "@shopify/ui-extensions": {
          distTags: { "2025-07": "2025.7.4", latest: "2025.7.4" },
          versions: {
            "2025.7.4": {
              files: { "build/ts/surfaces/admin/Foo.d.ts": "export {};" },
            },
          },
        },
      });

      runScript("--types-only --skip-versions -y", dataDir, {
        UPDATE_APIS_FAKE_NPM_DIR: fakeNpm,
      });

      const index = JSON.parse(
        readFileSync(path.join(dataDir, "types/index.json"), "utf-8"),
      );
      const slot = index["polaris-admin-extensions"]["2025-07"] as Array<{
        package: string;
        version: string;
      }>;
      const slotPackages = slot.map((p) => p.package);
      for (const pkg of [
        "@shopify/ui-extensions-react",
        "@remote-ui/react",
        "@remote-ui/async-subscription",
        "@remote-ui/core",
        "@remote-ui/rpc",
        "@remote-ui/types",
        "@types/react-reconciler",
      ]) {
        expect(slotPackages).toContain(pkg);
      }

      // Direct dep declared as `^5.0.6` in the parent's package.json fixture
      // → resolveSemverRange picks the highest 5.x stable (here: 5.0.6).
      const remoteUiReact = slot.find((p) => p.package === "@remote-ui/react");
      expect(remoteUiReact?.version).toBe(
        UI_EXTENSIONS_REACT_TRANSITIVE_VERSIONS["@remote-ui/react"],
      );

      // Sub-transitive (not declared in parent, pinned in the recipe) →
      // uses the pinned version *even though the fake-npm dist-tag `latest`
      // points at a higher decoy version*. This catches the regression
      // where deeper undeclared deps used to fall back to `latest` and
      // land outside the declared range of their grandparent.
      const remoteUiCore = slot.find((p) => p.package === "@remote-ui/core");
      expect(remoteUiCore?.version).toBe(
        UI_EXTENSIONS_REACT_TRANSITIVE_VERSIONS["@remote-ui/core"],
      );
      const reactReconciler = slot.find(
        (p) => p.package === "@types/react-reconciler",
      );
      expect(reactReconciler?.version).toBe(
        UI_EXTENSIONS_REACT_TRANSITIVE_VERSIONS["@types/react-reconciler"],
      );
      // Decoy "latest" must NOT win.
      expect(remoteUiCore?.version).not.toBe("99.0.0");
      expect(reactReconciler?.version).not.toBe("99.0.0");

      // Files actually land on disk under types/<pkg>/<version>/.
      expect(
        existsSync(
          path.join(
            dataDir,
            `types/@remote-ui/react/${UI_EXTENSIONS_REACT_TRANSITIVE_VERSIONS["@remote-ui/react"]}/index.d.ts`,
          ),
        ),
      ).toBe(true);
      expect(
        existsSync(
          path.join(
            dataDir,
            `types/@types/react-reconciler/${UI_EXTENSIONS_REACT_TRANSITIVE_VERSIONS["@types/react-reconciler"]}/index.d.ts`,
          ),
        ),
      ).toBe(true);
    });

    it("pins @types/react to the version in ALWAYS_LOADED_TYPE_PACKAGES, not npm latest", () => {
      // @remote-ui/react@5.0.8 declares `@types/react: >=17.0.0 <19.0.0`.
      // npm's `latest` dist-tag for @types/react is on 19.x, so without an
      // explicit pin the always-loaded path would write React 19 types into
      // every API slot — outside the React bindings' declared range. This
      // test publishes `latest=19.0.0` in fake-npm and asserts the script
      // resolves to the pinned 18.x version anyway.
      const dataDir = makeIsolatedDataDir({
        supportedVersions: emptyUiSupportedVersions(),
      });
      const fakeNpm = makeFakeNpmDir(ALWAYS_LOADED_FIXTURES);

      runScript("--types-only --skip-versions -y", dataDir, {
        UPDATE_APIS_FAKE_NPM_DIR: fakeNpm,
      });

      const index = JSON.parse(
        readFileSync(path.join(dataDir, "types/index.json"), "utf-8"),
      );
      expect(index._always_loaded).toContainEqual({
        package: "@types/react",
        version: TYPES_REACT_PINNED_VERSION,
      });
      expect(index._always_loaded).not.toContainEqual({
        package: "@types/react",
        version: "19.0.0",
      });
      expect(
        existsSync(
          path.join(
            dataDir,
            `types/@types/react/${TYPES_REACT_PINNED_VERSION}/index.d.ts`,
          ),
        ),
      ).toBe(true);
      expect(existsSync(path.join(dataDir, "types/@types/react/19.0.0"))).toBe(
        false,
      );
    });

    it("scopes @shopify/ui-extensions-react to the 2025-07 slot only", () => {
      // Regression: api-mapping.ts tags the React bindings with
      // `versions: ["2025-07"]` because the package predates the
      // web-component migration. Without that filter, the script wrote
      // React@2025.7.4 into every supported version slot — making
      // validateComponentCodeBlock accept React imports on
      // web-component-era versions like 2026-04. Assert both shapes here so
      // either regression — the script side or the api-mapping side — is
      // caught.
      const supportedVersions = {
        ...emptyUiSupportedVersions(),
        "polaris-admin-extensions": [
          { name: "2026-04", latestVersion: true },
          { name: "2025-07" },
        ],
      };
      const dataDir = makeIsolatedDataDir({ supportedVersions });
      const fakeNpm = makeFakeNpmDir({
        ...ALWAYS_LOADED_FIXTURES,
        ...UI_EXTENSIONS_REACT_FIXTURE,
        "@shopify/ui-extensions": {
          distTags: {
            "2026-04": "2026.4.2",
            "2025-07": "2025.7.4",
            latest: "2026.4.2",
          },
          versions: {
            "2026.4.2": {
              files: { "build/ts/surfaces/admin/Foo.d.ts": "export {};" },
            },
            "2025.7.4": {
              files: { "build/ts/surfaces/admin/Foo.d.ts": "export {};" },
            },
          },
        },
      });

      runScript("--types-only --skip-versions -y", dataDir, {
        UPDATE_APIS_FAKE_NPM_DIR: fakeNpm,
      });

      const index = JSON.parse(
        readFileSync(path.join(dataDir, "types/index.json"), "utf-8"),
      );
      const packagesIn = (versionKey: string) =>
        (
          index["polaris-admin-extensions"][versionKey] as Array<{
            package: string;
          }>
        ).map((p) => p.package);

      // React + its transitive @remote-ui/* / @types/react-reconciler deps
      // land under the 2025-07 slot only.
      const reactClosure = [
        "@shopify/ui-extensions-react",
        "@remote-ui/react",
        "@remote-ui/async-subscription",
        "@remote-ui/core",
        "@remote-ui/rpc",
        "@remote-ui/types",
        "@types/react-reconciler",
      ];
      for (const pkg of reactClosure) {
        expect(packagesIn("2025-07")).toContain(pkg);
        expect(packagesIn("2026-04")).not.toContain(pkg);
      }
      // The web-component package itself must still land in both slots.
      expect(packagesIn("2025-07")).toContain("@shopify/ui-extensions");
      expect(packagesIn("2026-04")).toContain("@shopify/ui-extensions");
    });

    it("extracts unversioned polaris-app-home packages once at latest", () => {
      const dataDir = makeIsolatedDataDir({
        supportedVersions: emptyUiSupportedVersions(),
      });
      const fakeNpm = makeFakeNpmDir(ALWAYS_LOADED_FIXTURES);

      runScript("--types-only --skip-versions -y", dataDir, {
        UPDATE_APIS_FAKE_NPM_DIR: fakeNpm,
      });

      expect(
        existsSync(
          path.join(
            dataDir,
            "types/@shopify/polaris-types/1.0.7/dist/polaris.d.ts",
          ),
        ),
      ).toBe(true);
      expect(
        existsSync(
          path.join(
            dataDir,
            "types/@shopify/app-bridge-types/0.7.0/dist/index.d.ts",
          ),
        ),
      ).toBe(true);
      expect(
        existsSync(
          path.join(
            dataDir,
            "types/@shopify/app-bridge-react/4.2.10/build/types/esm/index.d.ts",
          ),
        ),
      ).toBe(true);

      const index = JSON.parse(
        readFileSync(path.join(dataDir, "types/index.json"), "utf-8"),
      );
      expect(index["polaris-app-home"]["_"]).toEqual([
        { package: "@shopify/polaris-types", version: "1.0.7" },
        { package: "@shopify/app-bridge-types", version: "0.7.0" },
        { package: "@shopify/app-bridge-react", version: "4.2.10" },
      ]);
      // storefront-web-components ships as a CDN script (not an npm package)
      // and validate_component_codeblocks short-circuits it as
      // UNSUPPORTED_COMPONENT_VALIDATION_API. It must not appear here.
      expect(index["storefront-web-components"]).toBeUndefined();
    });

    it("resolves hydrogen transitive deps from the package.json declared range", () => {
      const supportedVersions = {
        ...emptyUiSupportedVersions(),
        hydrogen: [{ name: "2026-04", latestVersion: true }],
      };
      const dataDir = makeIsolatedDataDir({ supportedVersions });
      const fakeNpm = makeFakeNpmDir({
        ...ALWAYS_LOADED_FIXTURES,
        "@shopify/hydrogen": {
          distTags: { "2026-04": "2026.4.2", latest: "2026.4.2" },
          versions: {
            "2026.4.2": {
              packageJson: {
                name: "@shopify/hydrogen",
                version: "2026.4.2",
                dependencies: {
                  graphql: "^16.0.0",
                  "@shopify/hydrogen-react": "2026.4.1",
                  "react-router": "^7.0.0",
                  "@react-router/dev": "^7.0.0",
                  "type-fest": "^5.0.0",
                  "schema-dts": "^1.0.0",
                },
              },
              files: { "dist/index.d.ts": "export {};" },
            },
          },
        },
        graphql: {
          distTags: { latest: "16.13.2" },
          versions: { "16.13.2": { files: { "index.d.ts": "export {};" } } },
        },
        "@shopify/hydrogen-react": {
          distTags: { latest: "2026.4.1" },
          versions: {
            "2026.4.1": { files: { "dist/index.d.ts": "export {};" } },
          },
        },
        "react-router": {
          distTags: { latest: "7.13.2" },
          versions: { "7.13.2": { files: { "index.d.ts": "export {};" } } },
        },
        "@react-router/dev": {
          distTags: { latest: "7.13.2" },
          versions: { "7.13.2": { files: { "index.d.ts": "export {};" } } },
        },
        "type-fest": {
          distTags: { latest: "5.5.0" },
          versions: { "5.5.0": { files: { "index.d.ts": "export {};" } } },
        },
        "schema-dts": {
          distTags: { latest: "1.1.5" },
          versions: { "1.1.5": { files: { "index.d.ts": "export {};" } } },
        },
      });

      runScript("--types-only --skip-versions -y", dataDir, {
        UPDATE_APIS_FAKE_NPM_DIR: fakeNpm,
      });

      const index = JSON.parse(
        readFileSync(path.join(dataDir, "types/index.json"), "utf-8"),
      );
      const hydroPackages = index.hydrogen["2026-04"].map(
        (p: { package: string }) => p.package,
      );
      expect(hydroPackages).toContain("@shopify/hydrogen");
      expect(hydroPackages).toContain("@shopify/hydrogen-react");
      expect(hydroPackages).toContain("react-router");
      expect(hydroPackages).toContain("@react-router/dev");
      expect(hydroPackages).toContain("graphql");
      expect(hydroPackages).toContain("type-fest");
      expect(hydroPackages).toContain("schema-dts");

      // Exact-version dep is resolved verbatim
      const hydroReact = index.hydrogen["2026-04"].find(
        (p: { package: string }) => p.package === "@shopify/hydrogen-react",
      );
      expect(hydroReact.version).toBe("2026.4.1");
    });

    it("YYYY.M.x fallback for hydrogen prefers the stable release over a prerelease", () => {
      // No 2026-04 dist-tag → resolveNpmVersionForApi falls back to scanning
      // YYYY.M.* versions. The published set includes an RC; the fallback
      // must pick the stable tarball regardless of how the comparator
      // happens to rank "-rc.N" suffixes.
      const supportedVersions = {
        ...emptyUiSupportedVersions(),
        hydrogen: [{ name: "2026-04", latestVersion: true }],
      };
      const dataDir = makeIsolatedDataDir({ supportedVersions });
      const fakeNpm = makeFakeNpmDir({
        ...ALWAYS_LOADED_FIXTURES,
        "@shopify/hydrogen": {
          // Note: no "2026-04" entry. `latest` exists but isn't consulted
          // here — the fallback resolves via the published versions list.
          distTags: { latest: "2026.4.2" },
          versions: {
            "2026.4.2": {
              packageJson: {
                name: "@shopify/hydrogen",
                version: "2026.4.2",
                dependencies: {
                  graphql: "^16.0.0",
                  "@shopify/hydrogen-react": "2026.4.1",
                  "react-router": "^7.0.0",
                  "@react-router/dev": "^7.0.0",
                  "type-fest": "^5.0.0",
                  "schema-dts": "^1.0.0",
                },
              },
              files: { "dist/stable.d.ts": "export const stable = true;" },
            },
            "2026.4.2-rc.1": {
              packageJson: {
                name: "@shopify/hydrogen",
                version: "2026.4.2-rc.1",
              },
              files: { "dist/rc.d.ts": "export const rc = true;" },
            },
          },
        },
        graphql: {
          distTags: { latest: "16.13.2" },
          versions: { "16.13.2": { files: { "index.d.ts": "export {};" } } },
        },
        "@shopify/hydrogen-react": {
          distTags: { latest: "2026.4.1" },
          versions: {
            "2026.4.1": { files: { "dist/index.d.ts": "export {};" } },
          },
        },
        "react-router": {
          distTags: { latest: "7.13.2" },
          versions: { "7.13.2": { files: { "index.d.ts": "export {};" } } },
        },
        "@react-router/dev": {
          distTags: { latest: "7.13.2" },
          versions: { "7.13.2": { files: { "index.d.ts": "export {};" } } },
        },
        "type-fest": {
          distTags: { latest: "5.5.0" },
          versions: { "5.5.0": { files: { "index.d.ts": "export {};" } } },
        },
        "schema-dts": {
          distTags: { latest: "1.1.5" },
          versions: { "1.1.5": { files: { "index.d.ts": "export {};" } } },
        },
      });

      runScript("--types-only --skip-versions -y", dataDir, {
        UPDATE_APIS_FAKE_NPM_DIR: fakeNpm,
      });

      const index = JSON.parse(
        readFileSync(path.join(dataDir, "types/index.json"), "utf-8"),
      );
      expect(index.hydrogen["2026-04"]).toContainEqual({
        package: "@shopify/hydrogen",
        version: "2026.4.2",
      });
      expect(
        existsSync(path.join(dataDir, "types/@shopify/hydrogen/2026.4.2")),
      ).toBe(true);
      expect(
        existsSync(path.join(dataDir, "types/@shopify/hydrogen/2026.4.2-rc.1")),
      ).toBe(false);
    });

    it("deletes type asset versions no longer referenced by the new index", () => {
      const supportedVersions = {
        ...emptyUiSupportedVersions(),
        "polaris-admin-extensions": [{ name: "2026-04", latestVersion: true }],
      };
      const dataDir = makeIsolatedDataDir({ supportedVersions });
      const fakeNpm = makeFakeNpmDir({
        ...ALWAYS_LOADED_FIXTURES,
        ...UI_EXTENSIONS_REACT_FIXTURE,
        "@shopify/ui-extensions": {
          distTags: { "2026-04": "2026.4.2", latest: "2026.4.2" },
          versions: {
            "2026.4.2": {
              files: { "build/ts/surfaces/admin/Foo.d.ts": "export {};" },
            },
          },
        },
      });

      // Pre-seed a stale type asset version
      const stale = path.join(
        dataDir,
        "types/@shopify/ui-extensions/9999.99.99/build/ts/surfaces/admin",
      );
      mkdirSync(stale, { recursive: true });
      writeFileSync(path.join(stale, "Stale.d.ts"), "stale");

      runScript("--types-only --skip-versions -y", dataDir, {
        UPDATE_APIS_FAKE_NPM_DIR: fakeNpm,
      });

      expect(
        existsSync(
          path.join(dataDir, "types/@shopify/ui-extensions/9999.99.99"),
        ),
      ).toBe(false);
      expect(
        existsSync(path.join(dataDir, "types/@shopify/ui-extensions/2026.4.2")),
      ).toBe(true);
    });

    it("warns and skips APIs that declare a surface package but lack extensionSurfaceName", () => {
      // The precheck in buildTypeExtractionPlan filters api.publicPackages
      // against any recipe with surfaceSubpath. A surface package without
      // extensionSurfaceName has no valid surface to slice, so the API must
      // be skipped with a warning rather than copy the wrong subtree.
      //
      // The real api-mapping.ts pairs every surface-package consumer with an
      // extensionSurfaceName, so we inject a fake one via the
      // UPDATE_APIS_API_MAPPING_MODULE override to exercise the guard.
      const supportedVersions = {
        ...emptyUiSupportedVersions(),
        "fake-broken-surface-api": [{ name: "2026-04", latestVersion: true }],
      };
      const dataDir = makeIsolatedDataDir({ supportedVersions });
      const fakeNpm = makeFakeNpmDir({
        ...ALWAYS_LOADED_FIXTURES,
        "@shopify/ui-extensions": {
          distTags: { "2026-04": "2026.4.2", latest: "2026.4.2" },
          versions: {
            "2026.4.2": {
              files: { "build/ts/surfaces/admin/Foo.d.ts": "export {};" },
            },
          },
        },
      });

      const overrideDir = mkdtempSync(path.join(os.tmpdir(), "api-override-"));
      const overrideMod = path.join(overrideDir, "api-mapping.mjs");
      writeFileSync(
        overrideMod,
        `export const SHOPIFY_APIS = {
          "fake-broken-surface-api": {
            name: "fake-broken-surface-api",
            versioned: true,
            publicPackages: ["@shopify/ui-extensions"],
            // extensionSurfaceName intentionally omitted to trigger the precheck
          },
        };
        export function getShopifyDevSchemaMap() { return {}; }
        export function getPublicPackagesList() { return ["@shopify/ui-extensions"]; }`,
      );

      const output = runScript("--types-only --skip-versions -y", dataDir, {
        UPDATE_APIS_FAKE_NPM_DIR: fakeNpm,
        UPDATE_APIS_API_MAPPING_MODULE: overrideMod,
      });

      expect(output).toContain(
        "fake-broken-surface-api: declares @shopify/ui-extensions but no extensionSurfaceName, skipping",
      );

      // The API must not appear in the index, and no @shopify/ui-extensions
      // type assets should have been extracted for it.
      const index = JSON.parse(
        readFileSync(path.join(dataDir, "types/index.json"), "utf-8"),
      );
      expect(index["fake-broken-surface-api"]).toBeUndefined();
      expect(
        existsSync(path.join(dataDir, "types/@shopify/ui-extensions")),
      ).toBe(false);
    });

    it("--schemas-only does not touch src/data/types", () => {
      const dataDir = makeIsolatedDataDir({
        supportedVersions: emptyUiSupportedVersions(),
      });
      // Pre-seed something under types/ — --schemas-only must leave it alone
      const sentinel = path.join(dataDir, "types/sentinel.txt");
      mkdirSync(path.dirname(sentinel), { recursive: true });
      writeFileSync(sentinel, "untouched");

      // --schemas-only fails when shopify-dev path isn't real, but that's
      // fine — we just need to confirm it doesn't enter the types extraction
      // step before erroring out.
      try {
        runScript(
          "--schemas-only --skip-versions --shopify-dev /nonexistent -y",
          dataDir,
        );
      } catch {
        // expected: schema step errors when path is missing
      }

      expect(existsSync(sentinel)).toBe(true);
    });
  });

  describe("getShopifyDevSchemaMap integration", () => {
    it("script can import the schema map from the built package", async () => {
      const { getShopifyDevSchemaMap } = await import("./api-mapping");
      const map = getShopifyDevSchemaMap();

      expect(typeof map).toBe("object");
      expect(map["admin"]).toBe("admin");
      expect(map["storefront"]).toBe("storefront-graphql");
      expect(Object.keys(map).length).toBeGreaterThan(10);
    });
  });

  describe("getPublicPackagesList integration", () => {
    it("returns unique public packages from API mappings", async () => {
      const { getPublicPackagesList } = await import("./api-mapping");
      const packages = getPublicPackagesList();

      expect(Array.isArray(packages)).toBe(true);
      expect(packages).toContain("@shopify/hydrogen");
      expect(packages).toContain("@shopify/ui-extensions");
      expect(packages).toContain("@shopify/polaris-types");
      expect(packages).toContain("@shopify/app-bridge-types");
      expect(packages).toContain("@shopify/app-bridge-react");
      expect(packages.length).toBeGreaterThanOrEqual(5);

      const uniqueCheck = new Set(packages);
      expect(uniqueCheck.size).toBe(packages.length);
    });
  });

  describe("supported-versions-schema.json invariants", () => {
    // loadAPISchemas picks the entry flagged latestVersion: true when no
    // version override is supplied. If an API has zero or multiple flagged
    // entries the picker is ambiguous, so guard the invariant at the data
    // level. update-apis.mjs is the only writer of this file, so this is the
    // contract that script must preserve.
    it("every API has exactly one latestVersion: true entry", () => {
      const supportedVersionsPath = path.join(
        ROOT_DIR,
        "src/data/supported-versions-schema.json",
      );
      const config = JSON.parse(
        readFileSync(supportedVersionsPath, "utf-8"),
      ) as Record<string, { name: string; latestVersion?: boolean }[]>;

      const violations: string[] = [];
      for (const [api, versions] of Object.entries(config)) {
        if (versions.length === 0) continue;
        const flagged = versions.filter((v) => v.latestVersion === true);
        if (flagged.length !== 1) {
          violations.push(
            `${api}: expected 1 latestVersion entry, found ${flagged.length} (${
              flagged.map((v) => v.name).join(", ") || "none"
            })`,
          );
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe("internal module exports", () => {
    it("exports getShopifyDevSchemaMap that includes public APIs", async () => {
      const { getShopifyDevSchemaMap } =
        await import("../internal/api-mapping");
      const map = getShopifyDevSchemaMap();

      expect(typeof map).toBe("object");
      expect(map["admin"]).toBe("admin");
      expect(map["storefront"]).toBe("storefront-graphql");
      expect(Object.keys(map).length).toBeGreaterThan(10);
    });

    it("exports getPublicPackagesList that includes public API packages", async () => {
      const { getPublicPackagesList } = await import("../internal/api-mapping");
      const packages = getPublicPackagesList();

      expect(Array.isArray(packages)).toBe(true);
      expect(packages).toContain("@shopify/hydrogen");
      expect(packages).toContain("@shopify/ui-extensions");
      expect(packages.length).toBeGreaterThanOrEqual(4);
    });

    it("internal schema map is a superset of public schema map", async () => {
      const { getShopifyDevSchemaMap: getPublicMap } =
        await import("./api-mapping");
      const { getShopifyDevSchemaMap: getInternalMap } =
        await import("../internal/api-mapping");

      const publicMap = getPublicMap();
      const internalMap = getInternalMap();

      for (const [key, value] of Object.entries(publicMap)) {
        expect(internalMap[key]).toBe(value);
      }
      expect(Object.keys(internalMap).length).toBeGreaterThanOrEqual(
        Object.keys(publicMap).length,
      );
    });
  });
});

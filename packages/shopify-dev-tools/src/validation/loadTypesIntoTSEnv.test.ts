import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gzipSync } from "zlib";

import {
  createVirtualTSEnvironment,
  type VirtualTSEnvironment,
} from "./createVirtualTSEnvironment";
import {
  _setTypesDataDirForTesting,
  loadTypesIntoTSEnv,
  MissingPackageError,
  resolveJsxRuntime,
  resolveTypesDataDirectory,
} from "./loadTypesIntoTSEnv";

interface FixtureFile {
  /** Relative path inside the package version dir, e.g. "build/ts/surfaces/admin/components/Button.d.ts" */
  path: string;
  content: string;
  gzip?: boolean;
}

interface FixturePackage {
  name: string;
  version: string;
  files: FixtureFile[];
}

interface FixtureIndex {
  _always_loaded?: Array<{ package: string; version: string }>;
  [apiOrSpecial: string]:
    | Array<{ package: string; version: string }>
    | Record<string, Array<{ package: string; version: string }>>
    | undefined;
}

interface SupportedVersionEntry {
  name: string;
  latestVersion?: boolean;
  releaseCandidate?: boolean;
}

function writeFixtureTree({
  index,
  supportedVersions,
  packages,
}: {
  index: FixtureIndex;
  supportedVersions: Record<string, SupportedVersionEntry[]>;
  packages: FixturePackage[];
}): string {
  const tmpRoot = mkdtempSync(path.join(tmpdir(), "load-types-fixture-"));
  const dataDir = path.join(tmpRoot, "data");
  const typesDir = path.join(dataDir, "types");
  mkdirSync(typesDir, { recursive: true });

  writeFileSync(
    path.join(typesDir, "index.json"),
    JSON.stringify(index, null, 2),
  );
  writeFileSync(
    path.join(dataDir, "supported-versions-schema.json"),
    JSON.stringify(supportedVersions, null, 2),
  );

  for (const pkg of packages) {
    const pkgRoot = path.join(typesDir, pkg.name, pkg.version);
    mkdirSync(pkgRoot, { recursive: true });
    // package.json (always present)
    writeFileSync(
      path.join(pkgRoot, "package.json"),
      JSON.stringify({ name: pkg.name, version: pkg.version }, null, 2),
    );
    for (const f of pkg.files) {
      const abs = path.join(pkgRoot, f.path);
      mkdirSync(path.dirname(abs), { recursive: true });
      if (f.gzip) {
        writeFileSync(abs + ".gz", gzipSync(Buffer.from(f.content, "utf-8")));
      } else {
        writeFileSync(abs, f.content);
      }
    }
  }

  return typesDir;
}

describe("loadTypesIntoTSEnv", () => {
  let virtualEnv: VirtualTSEnvironment;
  let cleanupDirs: string[];

  beforeEach(() => {
    cleanupDirs = [];
    virtualEnv = createVirtualTSEnvironment("polaris-app-home");
  });

  afterEach(() => {
    _setTypesDataDirForTesting(undefined);
    for (const d of cleanupDirs) {
      // Remove the tmp tree's grandparent (the mkdtempSync root)
      const root = path.resolve(d, "../..");
      rmSync(root, { recursive: true, force: true });
    }
  });

  function applyFixture(typesDir: string): void {
    cleanupDirs.push(typesDir);
    _setTypesDataDirForTesting(typesDir);
  }

  function expectVirtualHas(suffix: string): void {
    const keys = Array.from(virtualEnv.virtualFiles.keys());
    expect(
      keys.some((k) => k.endsWith(suffix)),
      `expected a virtual file ending in ${suffix}, got:\n${keys.join("\n")}`,
    ).toBe(true);
  }

  function expectVirtualLacks(suffix: string): void {
    const keys = Array.from(virtualEnv.virtualFiles.keys());
    expect(
      keys.some((k) => k.endsWith(suffix)),
      `expected no virtual file ending in ${suffix}, got match in:\n${keys.join("\n")}`,
    ).toBe(false);
  }

  describe("MissingPackageError", () => {
    it("creates error with package name and message", () => {
      const error = new MissingPackageError(
        "test-package",
        "Package not found",
      );
      expect(error.name).toStrictEqual("MissingPackageError");
      expect(error.packageName).toStrictEqual("test-package");
      expect(error.message).toStrictEqual("Package not found");
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("unversioned APIs", () => {
    it("loads polaris-app-home packages from the `_` key", async () => {
      const typesDir = writeFixtureTree({
        index: {
          _always_loaded: [],
          "polaris-app-home": {
            _: [
              { package: "@shopify/polaris-types", version: "1.0.0" },
              { package: "@shopify/app-bridge-types", version: "0.7.0" },
            ],
          },
        },
        supportedVersions: {},
        packages: [
          {
            name: "@shopify/polaris-types",
            version: "1.0.0",
            files: [{ path: "dist/polaris.d.ts", content: "export {};" }],
          },
          {
            name: "@shopify/app-bridge-types",
            version: "0.7.0",
            files: [{ path: "dist/index.d.ts", content: "export {};" }],
          },
        ],
      });
      applyFixture(typesDir);

      const result = await loadTypesIntoTSEnv(
        "polaris-app-home",
        undefined,
        virtualEnv,
      );

      expect(result.missingPackages).toStrictEqual([]);
      expectVirtualHas(path.join("@shopify/polaris-types", "package.json"));
      expectVirtualHas(
        path.join("@shopify/polaris-types", "dist", "polaris.d.ts"),
      );
      expectVirtualHas(
        path.join("@shopify/app-bridge-types", "dist", "index.d.ts"),
      );
    });
  });

  describe("versioned APIs", () => {
    it("loads the requested apiVersion's packages", async () => {
      const typesDir = writeFixtureTree({
        index: {
          _always_loaded: [],
          "polaris-checkout-extensions": {
            "2026-01": [
              { package: "@shopify/ui-extensions", version: "2026.1.3" },
            ],
            "2025-07": [
              { package: "@shopify/ui-extensions", version: "2025.7.4" },
            ],
          },
        },
        supportedVersions: {},
        packages: [
          {
            name: "@shopify/ui-extensions",
            version: "2026.1.3",
            files: [
              {
                path: "build/ts/surfaces/checkout/components/V26.d.ts",
                content: "export const V26 = 1;",
              },
            ],
          },
          {
            name: "@shopify/ui-extensions",
            version: "2025.7.4",
            files: [
              {
                path: "build/ts/surfaces/checkout/components/V25.d.ts",
                content: "export const V25 = 1;",
              },
            ],
          },
        ],
      });
      applyFixture(typesDir);

      const result = await loadTypesIntoTSEnv(
        "polaris-checkout-extensions",
        "2026-01",
        virtualEnv,
      );

      expect(result.missingPackages).toStrictEqual([]);
      expectVirtualHas(path.join("checkout", "components", "V26.d.ts"));
      expectVirtualLacks(path.join("checkout", "components", "V25.d.ts"));
    });

    it("falls back to latestVersion when apiVersion is omitted", async () => {
      const typesDir = writeFixtureTree({
        index: {
          _always_loaded: [],
          "polaris-checkout-extensions": {
            "2026-01": [
              { package: "@shopify/ui-extensions", version: "2026.1.3" },
            ],
            "2025-07": [
              { package: "@shopify/ui-extensions", version: "2025.7.4" },
            ],
          },
        },
        supportedVersions: {
          "polaris-checkout-extensions": [
            { name: "2026-01", latestVersion: true },
            { name: "2025-07" },
          ],
        },
        packages: [
          {
            name: "@shopify/ui-extensions",
            version: "2026.1.3",
            files: [
              {
                path: "build/ts/surfaces/checkout/components/V26.d.ts",
                content: "export const V26 = 1;",
              },
            ],
          },
          {
            name: "@shopify/ui-extensions",
            version: "2025.7.4",
            files: [
              {
                path: "build/ts/surfaces/checkout/components/V25.d.ts",
                content: "export const V25 = 1;",
              },
            ],
          },
        ],
      });
      applyFixture(typesDir);

      const result = await loadTypesIntoTSEnv(
        "polaris-checkout-extensions",
        undefined,
        virtualEnv,
      );

      expect(result.missingPackages).toStrictEqual([]);
      expectVirtualHas(path.join("checkout", "components", "V26.d.ts"));
      expectVirtualLacks(path.join("checkout", "components", "V25.d.ts"));
    });
  });

  describe("ui-extensions surface filtering", () => {
    it("only loads files in the requested extensionSurface", async () => {
      const typesDir = writeFixtureTree({
        index: {
          _always_loaded: [],
          "polaris-checkout-extensions": {
            "2026-01": [
              { package: "@shopify/ui-extensions", version: "2026.1.3" },
            ],
          },
        },
        supportedVersions: {},
        packages: [
          {
            name: "@shopify/ui-extensions",
            version: "2026.1.3",
            files: [
              {
                path: "build/ts/surfaces/checkout/components/CheckoutOnly.d.ts",
                content: "export const c = 1;",
              },
              {
                path: "build/ts/surfaces/admin/components/AdminOnly.d.ts",
                content: "export const a = 1;",
              },
            ],
          },
        ],
      });
      applyFixture(typesDir);

      await loadTypesIntoTSEnv(
        "polaris-checkout-extensions",
        "2026-01",
        virtualEnv,
      );

      expectVirtualHas(
        path.join("surfaces", "checkout", "components", "CheckoutOnly.d.ts"),
      );
      expectVirtualLacks(
        path.join("surfaces", "admin", "components", "AdminOnly.d.ts"),
      );
    });

    it("with extensionTarget, loads only components imported by the target", async () => {
      const typesDir = writeFixtureTree({
        index: {
          _always_loaded: [],
          "polaris-admin-extensions": {
            "2026-01": [
              { package: "@shopify/ui-extensions", version: "2026.1.3" },
            ],
          },
        },
        supportedVersions: {},
        packages: [
          {
            name: "@shopify/ui-extensions",
            version: "2026.1.3",
            files: [
              {
                path: "build/ts/surfaces/admin/targets/admin.product-details.block.render.d.ts",
                content: `import "../components/Page.d.ts";\nimport "../components/Button.d.ts";`,
              },
              {
                path: "build/ts/surfaces/admin/components/Page.d.ts",
                content: "export const Page = 1;",
              },
              {
                path: "build/ts/surfaces/admin/components/Button.d.ts",
                content: "export const Button = 1;",
              },
              {
                path: "build/ts/surfaces/admin/components/UnusedComponent.d.ts",
                content: "export const UnusedComponent = 1;",
              },
              {
                path: "build/ts/surfaces/admin/components/components-shared.d.ts",
                content: "export const shared = 1;",
              },
              {
                path: "build/ts/surfaces/admin/globals.d.ts",
                content: "export const g = 1;",
              },
              {
                path: "build/ts/api.d.ts",
                content: "export const api = 1;",
              },
            ],
          },
        ],
      });
      applyFixture(typesDir);

      await loadTypesIntoTSEnv(
        "polaris-admin-extensions",
        "2026-01",
        virtualEnv,
        "admin.product-details.block.render",
      );

      expectVirtualHas(path.join("admin", "components", "Page.d.ts"));
      expectVirtualHas(path.join("admin", "components", "Button.d.ts"));
      expectVirtualHas(
        path.join("admin", "components", "components-shared.d.ts"),
      );
      expectVirtualHas(path.join("admin", "globals.d.ts"));
      expectVirtualHas(path.join("build", "ts", "api.d.ts"));
      expectVirtualLacks(
        path.join("admin", "components", "UnusedComponent.d.ts"),
      );
    });

    it("reports hasTargetSubpath=true when the per-target d.ts exists", async () => {
      const typesDir = writeFixtureTree({
        index: {
          _always_loaded: [],
          "polaris-admin-extensions": {
            "2026-01": [
              { package: "@shopify/ui-extensions", version: "2026.1.3" },
            ],
          },
        },
        supportedVersions: {},
        packages: [
          {
            name: "@shopify/ui-extensions",
            version: "2026.1.3",
            files: [
              {
                path: "build/ts/surfaces/admin/targets/admin.product-details.block.render.d.ts",
                content: "export const t = 1;",
              },
            ],
          },
        ],
      });
      applyFixture(typesDir);

      const result = await loadTypesIntoTSEnv(
        "polaris-admin-extensions",
        "2026-01",
        virtualEnv,
        "admin.product-details.block.render",
      );

      expect(result.hasTargetSubpath).toBe(true);
    });

    it("reports invalidTarget when targets/ exists but the requested target's d.ts is missing", async () => {
      // Modern web-component-era packages (2025-10+) ship a populated
      // `targets/` subtree. A typoed or unsupported target name must surface
      // as `invalidTarget` so the caller can fail fast — falling back to
      // whole-surface loading would silently accept the bad target.
      const typesDir = writeFixtureTree({
        index: {
          _always_loaded: [],
          "polaris-admin-extensions": {
            "2026-01": [
              { package: "@shopify/ui-extensions", version: "2026.1.3" },
            ],
          },
        },
        supportedVersions: {},
        packages: [
          {
            name: "@shopify/ui-extensions",
            version: "2026.1.3",
            files: [
              {
                path: "build/ts/surfaces/admin/targets/admin.product-details.block.render.d.ts",
                content: "export const t = 1;",
              },
              {
                path: "build/ts/surfaces/admin/targets/admin.order-details.block.render.d.ts",
                content: "export const t = 1;",
              },
            ],
          },
        ],
      });
      applyFixture(typesDir);

      const result = await loadTypesIntoTSEnv(
        "polaris-admin-extensions",
        "2026-01",
        virtualEnv,
        "admin.product-detials.block.render", // typo: "detials"
      );

      expect(result.hasTargetSubpath).toBe(false);
      expect(result.invalidTarget).toEqual({
        target: "admin.product-detials.block.render",
        surface: "admin",
        supported: [
          "admin.order-details.block.render",
          "admin.product-details.block.render",
        ],
      });
      // Crucially, the loader must NOT fall back to whole-surface loading
      // when targets/ exists — otherwise the validator would see a fully
      // populated surface tree and silently pass the typo.
      expectVirtualLacks(
        path.join(
          "admin",
          "targets",
          "admin.product-details.block.render.d.ts",
        ),
      );
    });

    it("reports hasTargetSubpath=false when the version's asset tree has no targets/ subtree (e.g. 2025-07 React-only)", async () => {
      const typesDir = writeFixtureTree({
        index: {
          _always_loaded: [],
          "polaris-admin-extensions": {
            "2025-07": [
              { package: "@shopify/ui-extensions", version: "2025.7.4" },
            ],
          },
        },
        supportedVersions: {},
        packages: [
          {
            name: "@shopify/ui-extensions",
            version: "2025.7.4",
            files: [
              {
                path: "build/ts/surfaces/admin.d.ts",
                content: "export * from './admin/components';",
              },
              {
                path: "build/ts/surfaces/admin/components.d.ts",
                content: "export const c = 1;",
              },
            ],
          },
        ],
      });
      applyFixture(typesDir);

      const result = await loadTypesIntoTSEnv(
        "polaris-admin-extensions",
        "2025-07",
        virtualEnv,
        "admin.product-details.block.render",
      );

      expect(result.hasTargetSubpath).toBe(false);
    });

    it("filters @shopify/ui-extensions-react to the requested extensionSurface", async () => {
      // `@shopify/ui-extensions-react` is gated to `versions: ["2025-07"]` in
      // the API mapping (React bindings predate the web-component migration).
      // Using "2026-01" here would version-filter the React package out
      // before the surface matcher even ran.
      const typesDir = writeFixtureTree({
        index: {
          _always_loaded: [],
          "polaris-checkout-extensions": {
            "2025-07": [
              { package: "@shopify/ui-extensions", version: "2026.1.3" },
              {
                package: "@shopify/ui-extensions-react",
                version: "2025.7.4",
              },
            ],
          },
        },
        supportedVersions: {},
        packages: [
          {
            name: "@shopify/ui-extensions",
            version: "2026.1.3",
            files: [
              {
                path: "build/ts/surfaces/checkout/components/V26.d.ts",
                content: "export const v = 1;",
              },
            ],
          },
          {
            name: "@shopify/ui-extensions-react",
            version: "2025.7.4",
            files: [
              {
                path: "build/ts/surfaces/checkout.d.ts",
                content: "export * from './checkout/Banner';",
              },
              {
                path: "build/ts/surfaces/checkout/Banner.d.ts",
                content: "export const Banner = 1;",
              },
              {
                path: "build/ts/surfaces/admin.d.ts",
                content: "export * from './admin/Page';",
              },
              {
                path: "build/ts/surfaces/admin/Page.d.ts",
                content: "export const Page = 1;",
              },
              {
                path: "build/ts/surfaces/customer-account/Block.d.ts",
                content: "export const Block = 1;",
              },
              {
                path: "build/ts/surfaces/point-of-sale/Tile.d.ts",
                content: "export const Tile = 1;",
              },
            ],
          },
        ],
      });
      applyFixture(typesDir);

      await loadTypesIntoTSEnv(
        "polaris-checkout-extensions",
        "2025-07",
        virtualEnv,
      );

      expectVirtualHas(
        path.join(
          "@shopify/ui-extensions-react",
          "build",
          "ts",
          "surfaces",
          "checkout",
          "Banner.d.ts",
        ),
      );
      // The sibling entry-point file referenced by `typesVersions` /
      // `exports.types` must load alongside the subtree — otherwise bare
      // surface imports like `from '@shopify/ui-extensions-react/checkout'`
      // fail to resolve in the virtual TS environment.
      expectVirtualHas(
        path.join(
          "@shopify/ui-extensions-react",
          "build",
          "ts",
          "surfaces",
          "checkout.d.ts",
        ),
      );
      // The sibling for a different surface must NOT load — the predicate
      // should match only the requested surface's entry-point.
      expectVirtualLacks(
        path.join(
          "@shopify/ui-extensions-react",
          "build",
          "ts",
          "surfaces",
          "admin.d.ts",
        ),
      );
    });

    // The customer-account surface re-exports from `../../checkout` (the React
    // bindings' `shared-checkout-components` and the non-React 2025.7
    // customer-account barrel both do this). The matcher's co-required-surface
    // table must pull in the checkout subtree alongside customer-account —
    // without it, TS emits "Cannot find module '../../checkout'" and every
    // forwarded symbol collapses to `any`.
    it("includes the checkout subtree when loading the customer-account surface (cross-surface dep)", async () => {
      const typesDir = writeFixtureTree({
        index: {
          _always_loaded: [],
          "polaris-customer-account-extensions": {
            "2025-07": [
              {
                package: "@shopify/ui-extensions-react",
                version: "2025.7.4",
              },
            ],
          },
        },
        supportedVersions: {},
        packages: [
          {
            name: "@shopify/ui-extensions-react",
            version: "2025.7.4",
            files: [
              {
                path: "build/ts/surfaces/customer-account.d.ts",
                content: "export * from './customer-account/components';",
              },
              {
                path: "build/ts/surfaces/customer-account/components/shared-checkout-components.d.ts",
                content: "export { Badge } from '../../checkout';",
              },
              {
                path: "build/ts/surfaces/checkout.d.ts",
                content: "export * from './checkout/Badge';",
              },
              {
                path: "build/ts/surfaces/checkout/Badge.d.ts",
                content: "export const Badge = 1;",
              },
              {
                path: "build/ts/surfaces/admin.d.ts",
                content: "export const adminEntry = 1;",
              },
              {
                path: "build/ts/surfaces/admin/Page.d.ts",
                content: "export const Page = 1;",
              },
              {
                path: "build/ts/surfaces/point-of-sale/Tile.d.ts",
                content: "export const Tile = 1;",
              },
            ],
          },
        ],
      });
      applyFixture(typesDir);

      await loadTypesIntoTSEnv(
        "polaris-customer-account-extensions",
        "2025-07",
        virtualEnv,
      );

      // customer-account surface entry + subtree load.
      expectVirtualHas(path.join("surfaces", "customer-account.d.ts"));
      expectVirtualHas(
        path.join(
          "surfaces",
          "customer-account",
          "components",
          "shared-checkout-components.d.ts",
        ),
      );
      // The co-required checkout entry + subtree must load — that's what this
      // test exists to verify.
      expectVirtualHas(path.join("surfaces", "checkout.d.ts"));
      expectVirtualHas(path.join("surfaces", "checkout", "Badge.d.ts"));
      // Other surfaces must still be excluded; the co-required table only
      // names checkout for customer-account.
      expectVirtualLacks(path.join("surfaces", "admin.d.ts"));
      expectVirtualLacks(path.join("surfaces", "admin", "Page.d.ts"));
      expectVirtualLacks(path.join("surfaces", "point-of-sale", "Tile.d.ts"));
    });

    it("falls back to loading the whole surface when the target file is missing", async () => {
      const typesDir = writeFixtureTree({
        index: {
          _always_loaded: [],
          "polaris-admin-extensions": {
            "2026-01": [
              { package: "@shopify/ui-extensions", version: "2026.1.3" },
            ],
          },
        },
        supportedVersions: {},
        packages: [
          {
            name: "@shopify/ui-extensions",
            version: "2026.1.3",
            files: [
              {
                path: "build/ts/surfaces/admin/components/Anything.d.ts",
                content: "export const a = 1;",
              },
            ],
          },
        ],
      });
      applyFixture(typesDir);

      await loadTypesIntoTSEnv(
        "polaris-admin-extensions",
        "2026-01",
        virtualEnv,
        "non.existent.target",
      );

      expectVirtualHas(path.join("admin", "components", "Anything.d.ts"));
    });

    // The two `surfaceMatcher` call sites for `@shopify/ui-extensions`
    // (target-less load and target-fallback) must load the surface subtree,
    // the sibling entry-point file referenced by `typesVersions` /
    // `exports.types`, and the top-level `build/ts/*.d.ts` entry-point files
    // imported via `../../` from inside surface subtrees — while excluding
    // every other surface's subtree, sibling, and any nested non-entry files.
    it("loads sibling entry-point + top-level files and excludes other surfaces for @shopify/ui-extensions (target-less)", async () => {
      const typesDir = writeFixtureTree({
        index: {
          _always_loaded: [],
          "polaris-checkout-extensions": {
            "2026-01": [
              { package: "@shopify/ui-extensions", version: "2026.1.3" },
            ],
          },
        },
        supportedVersions: {},
        packages: [
          {
            name: "@shopify/ui-extensions",
            version: "2026.1.3",
            files: [
              // Requested surface — subtree + sibling entry-point.
              {
                path: "build/ts/surfaces/checkout/components/CheckoutOnly.d.ts",
                content: "export const c = 1;",
              },
              {
                path: "build/ts/surfaces/checkout.d.ts",
                content: "export * from './checkout/components/CheckoutOnly';",
              },
              // Top-level entry-point files surface code imports via
              // `../../api`, `../../extension`, etc.
              {
                path: "build/ts/api.d.ts",
                content: "export const api = 1;",
              },
              {
                path: "build/ts/extension.d.ts",
                content: "export const extension = 1;",
              },
              {
                path: "build/ts/index.d.ts",
                content: "export const index = 1;",
              },
              // Nested non-entry file at `build/ts/` — must NOT load
              // (predicate is shallow).
              {
                path: "build/ts/utils/helper.d.ts",
                content: "export const helper = 1;",
              },
              // Other surfaces — subtree + sibling must NOT leak.
              {
                path: "build/ts/surfaces/admin/components/AdminOnly.d.ts",
                content: "export const a = 1;",
              },
              {
                path: "build/ts/surfaces/admin.d.ts",
                content: "export const adminEntry = 1;",
              },
              {
                path: "build/ts/surfaces/customer-account/components/CAOnly.d.ts",
                content: "export const ca = 1;",
              },
              {
                path: "build/ts/surfaces/point-of-sale/components/POSOnly.d.ts",
                content: "export const pos = 1;",
              },
            ],
          },
        ],
      });
      applyFixture(typesDir);

      await loadTypesIntoTSEnv(
        "polaris-checkout-extensions",
        "2026-01",
        virtualEnv,
      );

      // Requested surface loads.
      expectVirtualHas(
        path.join("surfaces", "checkout", "components", "CheckoutOnly.d.ts"),
      );
      expectVirtualHas(path.join("surfaces", "checkout.d.ts"));
      // Top-level entry-point files load.
      expectVirtualHas(path.join("build", "ts", "api.d.ts"));
      expectVirtualHas(path.join("build", "ts", "extension.d.ts"));
      expectVirtualHas(path.join("build", "ts", "index.d.ts"));
      // Nested file under `build/ts/` must NOT load — predicate is shallow.
      expectVirtualLacks(path.join("build", "ts", "utils", "helper.d.ts"));
      // Other surfaces — neither subtree nor sibling.
      expectVirtualLacks(
        path.join("surfaces", "admin", "components", "AdminOnly.d.ts"),
      );
      expectVirtualLacks(path.join("surfaces", "admin.d.ts"));
      expectVirtualLacks(
        path.join("surfaces", "customer-account", "components", "CAOnly.d.ts"),
      );
      expectVirtualLacks(
        path.join("surfaces", "point-of-sale", "components", "POSOnly.d.ts"),
      );
    });

    it("loads sibling entry-point + top-level files and excludes other surfaces for @shopify/ui-extensions (target-fallback)", async () => {
      const typesDir = writeFixtureTree({
        index: {
          _always_loaded: [],
          "polaris-checkout-extensions": {
            "2026-01": [
              { package: "@shopify/ui-extensions", version: "2026.1.3" },
            ],
          },
        },
        supportedVersions: {},
        packages: [
          {
            name: "@shopify/ui-extensions",
            version: "2026.1.3",
            files: [
              {
                path: "build/ts/surfaces/checkout/components/CheckoutOnly.d.ts",
                content: "export const c = 1;",
              },
              {
                path: "build/ts/surfaces/checkout.d.ts",
                content: "export * from './checkout/components/CheckoutOnly';",
              },
              {
                path: "build/ts/api.d.ts",
                content: "export const api = 1;",
              },
              {
                path: "build/ts/extension.d.ts",
                content: "export const extension = 1;",
              },
              {
                path: "build/ts/surfaces/admin/components/AdminOnly.d.ts",
                content: "export const a = 1;",
              },
              {
                path: "build/ts/surfaces/admin.d.ts",
                content: "export const adminEntry = 1;",
              },
            ],
          },
        ],
      });
      applyFixture(typesDir);

      // `non.existent.target` triggers the target-fallback branch in
      // `loadTargetSpecificComponents`, which delegates to `surfaceMatcher`.
      await loadTypesIntoTSEnv(
        "polaris-checkout-extensions",
        "2026-01",
        virtualEnv,
        "non.existent.target",
      );

      expectVirtualHas(
        path.join("surfaces", "checkout", "components", "CheckoutOnly.d.ts"),
      );
      expectVirtualHas(path.join("surfaces", "checkout.d.ts"));
      expectVirtualHas(path.join("build", "ts", "api.d.ts"));
      expectVirtualHas(path.join("build", "ts", "extension.d.ts"));
      expectVirtualLacks(
        path.join("surfaces", "admin", "components", "AdminOnly.d.ts"),
      );
      expectVirtualLacks(path.join("surfaces", "admin.d.ts"));
    });
  });

  describe("always-loaded packages", () => {
    it("loads preact and @types/react regardless of api", async () => {
      const typesDir = writeFixtureTree({
        index: {
          _always_loaded: [
            { package: "preact", version: "10.29.2" },
            { package: "@types/react", version: "19.0.0" },
          ],
          "polaris-app-home": {
            _: [{ package: "@shopify/polaris-types", version: "1.0.0" }],
          },
        },
        supportedVersions: {},
        packages: [
          {
            name: "@shopify/polaris-types",
            version: "1.0.0",
            files: [{ path: "dist/polaris.d.ts", content: "export {};" }],
          },
          {
            name: "preact",
            version: "10.29.2",
            files: [{ path: "src/index.d.ts", content: "export const x = 1;" }],
          },
          {
            name: "@types/react",
            version: "19.0.0",
            files: [{ path: "index.d.ts", content: "export const r = 1;" }],
          },
        ],
      });
      applyFixture(typesDir);

      await loadTypesIntoTSEnv("polaris-app-home", undefined, virtualEnv);

      expectVirtualHas(path.join("preact", "src", "index.d.ts"));
      expectVirtualHas(path.join("@types/react", "index.d.ts"));
    });
  });

  describe("gzipped assets", () => {
    it("transparently reads .d.ts.gz and package.json.gz", async () => {
      const typesDir = writeFixtureTree({
        index: {
          _always_loaded: [],
          "polaris-app-home": {
            _: [{ package: "@shopify/polaris-types", version: "1.0.0" }],
          },
        },
        supportedVersions: {},
        packages: [
          {
            name: "@shopify/polaris-types",
            version: "1.0.0",
            files: [
              {
                path: "dist/polaris.d.ts",
                content: "export const fromGzip = true;",
                gzip: true,
              },
            ],
          },
        ],
      });
      applyFixture(typesDir);

      await loadTypesIntoTSEnv("polaris-app-home", undefined, virtualEnv);

      const keys = Array.from(virtualEnv.virtualFiles.keys());
      const dtsKey = keys.find((k) =>
        k.endsWith(path.join("dist", "polaris.d.ts")),
      );
      expect(dtsKey).toBeDefined();
      expect(virtualEnv.virtualFiles.get(dtsKey!)).toStrictEqual(
        "export const fromGzip = true;",
      );
    });
  });

  describe("missing version handling", () => {
    it("returns missingPackages when the requested apiVersion is not in the index", async () => {
      const typesDir = writeFixtureTree({
        index: {
          _always_loaded: [],
          "polaris-checkout-extensions": {
            "2026-01": [
              { package: "@shopify/ui-extensions", version: "2026.1.3" },
            ],
          },
        },
        supportedVersions: {},
        packages: [
          {
            name: "@shopify/ui-extensions",
            version: "2026.1.3",
            files: [
              {
                path: "build/ts/surfaces/checkout/components/C.d.ts",
                content: "export const c = 1;",
              },
            ],
          },
        ],
      });
      applyFixture(typesDir);

      const result = await loadTypesIntoTSEnv(
        "polaris-checkout-extensions",
        "9999-99",
        virtualEnv,
      );

      expect(result.missingPackages).toContain("@shopify/ui-extensions");
      expect(result.searchedPaths.length).toBeGreaterThan(0);
    });

    it("returns missingPackages when an indexed package directory is absent", async () => {
      const typesDir = writeFixtureTree({
        index: {
          _always_loaded: [],
          "polaris-app-home": {
            _: [
              { package: "@shopify/polaris-types", version: "1.0.0" },
              { package: "@shopify/app-bridge-types", version: "0.7.0" },
            ],
          },
        },
        supportedVersions: {},
        // Only ship polaris-types — app-bridge-types is missing on disk.
        packages: [
          {
            name: "@shopify/polaris-types",
            version: "1.0.0",
            files: [{ path: "dist/polaris.d.ts", content: "export {};" }],
          },
        ],
      });
      applyFixture(typesDir);

      const result = await loadTypesIntoTSEnv(
        "polaris-app-home",
        undefined,
        virtualEnv,
      );

      expect(result.missingPackages).toContain("@shopify/app-bridge-types");
    });
  });

  describe("resolveTypesDataDirectory", () => {
    const localRoots: string[] = [];
    afterEach(() => {
      for (const r of localRoots.splice(0)) {
        rmSync(r, { recursive: true, force: true });
      }
    });

    it("picks the skill bundle's assets/types/ when sibling index.json exists", () => {
      const skillRoot = mkdtempSync(path.join(tmpdir(), "skill-bundle-"));
      localRoots.push(skillRoot);
      const scriptsDir = path.join(skillRoot, "scripts");
      const skillTypesDir = path.join(skillRoot, "assets", "types");
      mkdirSync(scriptsDir, { recursive: true });
      mkdirSync(skillTypesDir, { recursive: true });
      writeFileSync(path.join(skillTypesDir, "index.json"), "{}");

      expect(resolveTypesDataDirectory(scriptsDir)).toStrictEqual(
        skillTypesDir,
      );
    });

    it.each([
      {
        name: "dev-mcp/dist",
        currentDirSegments: ["dev-mcp", "dist"],
        expectedSegments: ["dev-mcp", "dist", "data", "types"],
      },
      {
        name: "shopify-dev-tools/dist",
        currentDirSegments: ["shopify-dev-tools", "dist", "validation"],
        expectedSegments: ["shopify-dev-tools", "dist", "data", "types"],
      },
      {
        name: "src tree",
        currentDirSegments: ["shopify-dev-tools", "src", "validation"],
        expectedSegments: ["shopify-dev-tools", "src", "data", "types"],
      },
    ])(
      "resolves the $name layout",
      ({ currentDirSegments, expectedSegments }) => {
        const root = mkdtempSync(path.join(tmpdir(), "types-layout-"));
        localRoots.push(root);
        const currentDir = path.join(root, ...currentDirSegments);
        mkdirSync(currentDir, { recursive: true });

        expect(resolveTypesDataDirectory(currentDir)).toStrictEqual(
          path.join(root, ...expectedSegments),
        );
      },
    );
  });

  describe("resolveJsxRuntime", () => {
    it("returns react when code imports @shopify/ui-extensions-react with a subpath", () => {
      expect(
        resolveJsxRuntime(
          "polaris-admin-extensions",
          `import { Banner } from "@shopify/ui-extensions-react/admin";`,
        ),
      ).toStrictEqual("react");
    });

    it("returns react when code imports @shopify/ui-extensions-react bare", () => {
      expect(
        resolveJsxRuntime(
          "polaris-admin-extensions",
          `import { Banner } from "@shopify/ui-extensions-react";`,
        ),
      ).toStrictEqual("react");
    });

    it("accepts single-quoted module specifiers", () => {
      expect(
        resolveJsxRuntime(
          "polaris-checkout-extensions",
          `import { Banner } from '@shopify/ui-extensions-react/checkout';`,
        ),
      ).toStrictEqual("react");
    });

    it("returns preact when code imports the Preact-flavored @shopify/ui-extensions package", () => {
      expect(
        resolveJsxRuntime(
          "polaris-checkout-extensions",
          `import { Banner } from "@shopify/ui-extensions/checkout";`,
        ),
      ).toStrictEqual("preact");
    });

    it("returns preact when code has no relevant imports", () => {
      expect(
        resolveJsxRuntime("polaris-checkout-extensions", `const x = 1;`),
      ).toStrictEqual("preact");
    });

    it("returns preact for empty code", () => {
      expect(
        resolveJsxRuntime("polaris-checkout-extensions", ``),
      ).toStrictEqual("preact");
    });

    it("returns react for hydrogen regardless of imports", () => {
      expect(
        resolveJsxRuntime(
          "hydrogen",
          `import { Banner } from "@shopify/ui-extensions/checkout";`,
        ),
      ).toStrictEqual("react");
      expect(resolveJsxRuntime("hydrogen", "")).toStrictEqual("react");
    });

    it("returns react for bare side-effect imports", () => {
      expect(
        resolveJsxRuntime(
          "polaris-admin-extensions",
          `import "@shopify/ui-extensions-react";`,
        ),
      ).toStrictEqual("react");
    });

    it("returns react for multi-line imports spanning newlines", () => {
      expect(
        resolveJsxRuntime(
          "polaris-admin-extensions",
          `import {\n  Banner,\n  Button,\n} from "@shopify/ui-extensions-react/admin";`,
        ),
      ).toStrictEqual("react");
    });

    it("returns react for re-exports", () => {
      expect(
        resolveJsxRuntime(
          "polaris-admin-extensions",
          `export { Banner } from "@shopify/ui-extensions-react/admin";`,
        ),
      ).toStrictEqual("react");
    });

    it("ignores the module specifier inside line comments", () => {
      expect(
        resolveJsxRuntime(
          "polaris-admin-extensions",
          `// import { Banner } from "@shopify/ui-extensions-react/admin";\nconst x = 1;`,
        ),
      ).toStrictEqual("preact");
    });

    it("ignores the module specifier inside string literals", () => {
      expect(
        resolveJsxRuntime(
          "polaris-admin-extensions",
          `const msg = "import x from '@shopify/ui-extensions-react/admin'";`,
        ),
      ).toStrictEqual("preact");
    });
  });

  describe("hydrogen fanout", () => {
    it("loads hydrogen plus all transitive deps from the index", async () => {
      const typesDir = writeFixtureTree({
        index: {
          _always_loaded: [],
          hydrogen: {
            "2026-04": [
              { package: "@shopify/hydrogen", version: "2026.4.2" },
              { package: "@shopify/hydrogen-react", version: "2026.4.2" },
              { package: "react-router", version: "7.14.0" },
            ],
          },
        },
        supportedVersions: {},
        packages: [
          {
            name: "@shopify/hydrogen",
            version: "2026.4.2",
            files: [
              {
                path: "dist/production/index.d.ts",
                content: "export const h = 1;",
              },
            ],
          },
          {
            name: "@shopify/hydrogen-react",
            version: "2026.4.2",
            files: [
              { path: "dist/index.d.ts", content: "export const hr = 1;" },
            ],
          },
          {
            name: "react-router",
            version: "7.14.0",
            files: [
              { path: "dist/index.d.ts", content: "export const rr = 1;" },
            ],
          },
        ],
      });
      applyFixture(typesDir);

      await loadTypesIntoTSEnv("hydrogen", "2026-04", virtualEnv);

      expectVirtualHas(path.join("@shopify/hydrogen", "package.json"));
      expectVirtualHas(
        path.join("@shopify/hydrogen-react", "dist", "index.d.ts"),
      );
      expectVirtualHas(path.join("react-router", "dist", "index.d.ts"));
    });
  });
});

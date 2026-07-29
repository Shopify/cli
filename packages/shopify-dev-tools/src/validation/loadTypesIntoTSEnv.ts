import { existsSync, readFileSync, readdirSync } from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { gunzipSync } from "zlib";

import { SHOPIFY_APIS } from "../config/api-mappings.js";
import {
  getPublicPackageName,
  publicPackageAppliesToVersion,
  type ShopifyAPIs,
} from "../types/api-mapping.js";
import type { VirtualTSEnvironment } from "./createVirtualTSEnvironment";
import { addFileToVirtualEnv } from "./createVirtualTSEnvironment";
import { extractShopifyComponents } from "./extractShopifyComponents";

export class MissingPackageError extends Error {
  constructor(
    public packageName: string,
    message: string,
  ) {
    super(message);
    this.name = "MissingPackageError";
  }
}

interface PackageRef {
  package: string;
  version: string;
}

interface TypesIndex {
  _always_loaded?: PackageRef[];
  [apiOrSpecial: string]:
    | PackageRef[]
    | Record<string, PackageRef[]>
    | undefined;
}

interface UnsupportedVersionInfo {
  requested: string;
  supported: string[];
}

interface InvalidTargetInfo {
  target: string;
  surface: string;
  supported: string[];
}

interface LoadTypesResult {
  missingPackages: string[];
  searchedPaths: string[];
  shopifyWebComponents: Set<string>;
  unsupportedVersion?: UnsupportedVersionInfo;
  /**
   * Set when the resolved `@shopify/ui-extensions` asset tree for the requested
   * `(version, surface)` ships a `targets/` subtree but the requested
   * `extensionTarget` isn't one of its bundled `.d.ts` files. This is the
   * "modern version + typoed/unsupported target" case — distinct from React-era
   * versions, where no `targets/` subtree exists at all and the target name
   * isn't a type-narrowing key. Callers should fail fast here rather than
   * falling back to whole-surface loading, which would silently accept invalid
   * targets.
   */
  invalidTarget?: InvalidTargetInfo;
  /**
   * Names of `publicPackages` entries that apply to the resolved version.
   * Tagged entries with a `versions` constraint that doesn't include the
   * resolved version are excluded. Callers that synthesize imports
   * (`formatCode`) MUST use this list rather than `apiConfig.publicPackages`
   * directly — otherwise they'll inject imports for packages whose surface
   * subtree wasn't loaded into the virtual env for this version.
   */
  applicablePackageNames: string[];
  /** True iff the bundled `@shopify/ui-extensions` asset tree for the requested
   * (version, surface) ships a per-target `.d.ts` for `extensionTarget`. When
   * false (e.g. `2025-07` admin, which is React-only and has no `targets/`
   * subtree), callers should NOT synthesize `'@shopify/ui-extensions/<target>'`
   * imports — those would only resolve via filesystem fall-through to a
   * different version installed on the host, giving non-deterministic results.
   */
  hasTargetSubpath: boolean;
}

interface SupportedVersionEntry {
  name: string;
  latestVersion?: boolean;
  releaseCandidate?: boolean;
}

let cachedIndex: TypesIndex | undefined;
let cachedTypesDataDir: string | undefined;
let cachedSupportedVersions:
  | Record<string, SupportedVersionEntry[]>
  | undefined;

/**
 * Pure resolver for the types data directory. Cascade:
 *   1. Skill bundle: validate.mjs lives at `<skill>/scripts/` with sibling
 *      `<skill>/assets/types/index.json`. Checked first because the skill
 *      install path can also satisfy looser /dist or dev-mcp probes.
 *   2. dev-mcp dist bundle.
 *   3. Any /dist tree (shopify-dev-tools dist).
 *   4. Source tree fallback (../data/types/ relative to this file).
 */
export function resolveTypesDataDirectory(currentDir: string): string {
  const skillTypesDir = path.resolve(currentDir, "..", "assets", "types");
  if (existsSync(path.join(skillTypesDir, "index.json"))) {
    return skillTypesDir;
  }

  if (
    currentDir.includes("dev-mcp") &&
    currentDir.includes("dist") &&
    !currentDir.includes("shopify-dev-tools")
  ) {
    return path.join(currentDir, "data", "types");
  }

  if (currentDir.includes("/dist") || currentDir.includes("\\dist")) {
    const distIndex = currentDir.lastIndexOf(path.sep + "dist");
    if (distIndex !== -1) {
      const distRoot = currentDir.substring(0, distIndex + 5);
      return path.join(distRoot, "data", "types");
    }
    return path.join(currentDir, "data", "types");
  }

  return path.resolve(currentDir, "../data/types");
}

function getTypesDataDirectory(): string {
  if (cachedTypesDataDir) return cachedTypesDataDir;
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  cachedTypesDataDir = resolveTypesDataDirectory(currentDir);
  return cachedTypesDataDir;
}

/**
 * Test seam: override the types data dir resolution. Pass `undefined` to reset.
 */
export function _setTypesDataDirForTesting(dir: string | undefined): void {
  cachedTypesDataDir = dir;
  cachedIndex = undefined;
  cachedSupportedVersions = undefined;
}

function readIndexJson(): TypesIndex {
  if (cachedIndex) return cachedIndex;
  const indexPath = path.join(getTypesDataDirectory(), "index.json");
  cachedIndex = JSON.parse(readFileSync(indexPath, "utf-8")) as TypesIndex;
  return cachedIndex;
}

function readSupportedVersions(): Record<string, SupportedVersionEntry[]> {
  if (cachedSupportedVersions) return cachedSupportedVersions;
  const typesDir = getTypesDataDirectory();
  const supportedVersionsPath = path.join(
    typesDir,
    "..",
    "supported-versions-schema.json",
  );
  cachedSupportedVersions = JSON.parse(
    readFileSync(supportedVersionsPath, "utf-8"),
  ) as Record<string, SupportedVersionEntry[]>;
  return cachedSupportedVersions;
}

function resolveLatestVersion(api: ShopifyAPIs): string | undefined {
  const versions = readSupportedVersions()[api];
  if (!versions) return undefined;
  return versions.find((v) => v.latestVersion)?.name;
}

/**
 * Returns the JSX runtime that matches the code under validation:
 * `react` when the code imports from `@shopify/ui-extensions-react/*`
 * (React-era extensions, e.g. polaris-admin-extensions 2025-07), and `preact`
 * otherwise (modern Polaris web-component era).
 *
 * JSX produced by Preact's runtime returns `VNode`, which does not satisfy
 * the `ReactElement` arms in Remote-DOM prop types — so React-era code needs
 * React's JSX runtime for prop validation to surface real errors instead of
 * a `VNode`-vs-`ReactElement` distraction chain. Modern web-component code
 * relies on Preact's JSX namespace for `<s-*>` IntrinsicElements coverage.
 */
export function resolveJsxRuntime(
  api: ShopifyAPIs,
  code: string,
): "react" | "preact" {
  if (api === "hydrogen") return "react";
  return /^\s*(?:import|export)\b[^'"]*['"]@shopify\/ui-extensions-react(?:\/[^'"]*)?['"]/m.test(
    code,
  )
    ? "react"
    : "preact";
}

function supportedVersionNames(api: ShopifyAPIs): string[] {
  return (readSupportedVersions()[api] ?? []).map((v) => v.name);
}

/**
 * Read an asset file. Handles either logical (`.d.ts`) or actual (`.d.ts.gz`)
 * paths transparently — the source tree ships raw files, the published
 * tarball ships gzipped files.
 */
function readAssetFile(absPath: string): string | undefined {
  if (absPath.endsWith(".gz")) {
    if (existsSync(absPath)) {
      return gunzipSync(readFileSync(absPath)).toString("utf-8");
    }
    const raw = absPath.slice(0, -3);
    if (existsSync(raw)) {
      return readFileSync(raw, "utf-8");
    }
    return undefined;
  }
  if (existsSync(absPath)) {
    return readFileSync(absPath, "utf-8");
  }
  const gz = absPath + ".gz";
  if (existsSync(gz)) {
    return gunzipSync(readFileSync(gz)).toString("utf-8");
  }
  return undefined;
}

/**
 * Recursively walk an asset directory, returning type-source files (`.d.ts`
 * and `.ts`). The `relPath` has any trailing `.gz` stripped so callers see
 * logical paths.
 */
function walkAssetDts(
  assetRoot: string,
  predicate?: (relPath: string) => boolean,
): Array<{ assetPath: string; relPath: string }> {
  const out: Array<{ assetPath: string; relPath: string }> = [];
  if (!existsSync(assetRoot)) return out;

  function walk(dir: string, prefix: string) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      const abs = path.join(dir, e.name);
      const logicalName = e.name.endsWith(".gz") ? e.name.slice(0, -3) : e.name;
      const rel = prefix ? `${prefix}/${logicalName}` : logicalName;
      if (e.isDirectory()) {
        walk(abs, rel);
      } else if (e.isFile()) {
        const isTypeFile =
          logicalName.endsWith(".d.ts") ||
          (logicalName.endsWith(".ts") &&
            !logicalName.endsWith(".test.ts") &&
            !logicalName.endsWith(".spec.ts"));
        if (!isTypeFile) continue;
        if (predicate && !predicate(rel)) continue;
        out.push({ assetPath: abs, relPath: rel });
      }
    }
  }
  walk(assetRoot, "");
  return out;
}

/**
 * The asset tree only ships the top-level `package.json` per `(pkg, version)`.
 * Packages like preact also publish nested package.json files (e.g.
 * `preact/jsx-runtime/package.json`) that legacy NodeJs module resolution
 * needs to resolve subpath imports like `import "preact/jsx-runtime"`.
 *
 * For every immediate subdirectory under `assetRoot` that has a logical
 * `src/index.d.ts` (or `index.d.ts`) but no logical `package.json`, synthesize
 * a minimal `<subdir>/package.json` pointing at it. This mirrors what npm
 * tarballs for split-entry-point packages actually ship.
 */
function synthesizeNestedPackageJsons(
  assetRoot: string,
  packageName: string,
  virtualEnv: VirtualTSEnvironment,
  packageRoot: string,
): void {
  let entries;
  try {
    entries = readdirSync(assetRoot, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const subAbs = path.join(assetRoot, e.name);
    const hasPkgJson =
      existsSync(path.join(subAbs, "package.json")) ||
      existsSync(path.join(subAbs, "package.json.gz"));
    if (hasPkgJson) continue;
    let typesEntry: string | undefined;
    if (
      existsSync(path.join(subAbs, "src", "index.d.ts")) ||
      existsSync(path.join(subAbs, "src", "index.d.ts.gz"))
    ) {
      typesEntry = "./src/index.d.ts";
    } else if (
      existsSync(path.join(subAbs, "index.d.ts")) ||
      existsSync(path.join(subAbs, "index.d.ts.gz"))
    ) {
      typesEntry = "./index.d.ts";
    }
    if (!typesEntry) continue;
    const synthesized = JSON.stringify({
      name: `${packageName}/${e.name}`,
      types: typesEntry,
    });
    const relPath = `${e.name}/package.json`;
    addAssetToVirtualEnv(
      virtualEnv,
      packageRoot,
      packageName,
      relPath,
      synthesized,
    );
  }
}

function virtualPathFor(
  packageRoot: string,
  packageName: string,
  relPath: string,
): string {
  return path.join(packageRoot, "node_modules", packageName, relPath);
}

function addAssetToVirtualEnv(
  virtualEnv: VirtualTSEnvironment,
  packageRoot: string,
  packageName: string,
  relPath: string,
  content: string,
  shopifyWebComponents?: Set<string>,
): void {
  const virtPath = virtualPathFor(packageRoot, packageName, relPath);
  addFileToVirtualEnv(virtualEnv, virtPath, content);
  if (shopifyWebComponents) {
    for (const tag of extractShopifyComponents(content, packageName)) {
      shopifyWebComponents.add(tag);
    }
  }
}

/**
 * Surfaces that re-export symbols from another surface in the same package and
 * therefore need that surface's declaration tree co-loaded with their own.
 *
 * Customer-account is the only known case at time of writing. In
 * `@shopify/ui-extensions-react@2025.7.4`, `surfaces/customer-account/components/shared-checkout-components.d.ts`
 * does `export { ... } from '../../checkout'`. In `@shopify/ui-extensions@2025.7.4`,
 * `surfaces/customer-account.d.ts` does `export * from './checkout/shared'` and
 * style subpaths. Newer `@shopify/ui-extensions` versions (2025.10+) dropped
 * the dependency, but the table is keyed by surface name (not package or
 * version) — co-loading checkout when it isn't strictly needed only inflates
 * the virtual env slightly; missing it produces "Cannot find module" errors.
 *
 * This table is a workaround for the path-based loader. A future recursive
 * import-following loader would derive this from the actual `from '...'`
 * edges in the declaration files and make the table obsolete.
 */
const CO_REQUIRED_SURFACES: Readonly<Record<string, readonly string[]>> = {
  "customer-account": ["checkout"],
};

/**
 * Predicate matching files that belong to a single UI extension surface inside
 * a `build/ts/surfaces/` tree, plus any co-required sibling surfaces listed in
 * `CO_REQUIRED_SURFACES`. Accepts:
 *   - the surface subtree (`surfaces/<surface>/...`)
 *   - the sibling entry-point file (`surfaces/<surface>.d.ts`) referenced by
 *     `typesVersions` / `exports.types`
 *   - top-level entry-point files at `build/ts/*.d.ts` (api, extension, index,
 *     preact, shared) — surface files import these via relative paths like
 *     `../../api`, `../../extension`; without them TS emits "Cannot find module"
 *
 * Both `@shopify/ui-extensions` and `@shopify/ui-extensions-react` follow this
 * layout.
 */
function surfaceMatcher(
  extensionSurfaceName: string,
): (relPath: string) => boolean {
  const surfaceNames = [
    extensionSurfaceName,
    ...(CO_REQUIRED_SURFACES[extensionSurfaceName] ?? []),
  ];
  const surfaceEntries = new Set(
    surfaceNames.map((s) => `build/ts/surfaces/${s}.d.ts`),
  );
  const surfaceSubtreePrefixes = surfaceNames.map(
    (s) => `build/ts/surfaces/${s}/`,
  );
  const topLevelPrefix = "build/ts/";
  return (rel) => {
    if (surfaceEntries.has(rel)) return true;
    if (surfaceSubtreePrefixes.some((p) => rel.startsWith(p))) return true;
    if (rel.startsWith(topLevelPrefix) && rel.endsWith(".d.ts")) {
      const rest = rel.slice(topLevelPrefix.length);
      if (!rest.includes("/")) return true;
    }
    return false;
  };
}

/**
 * Load every `.d.ts` under `assetRoot` (optionally filtered) into the virtual
 * environment under `<packageRoot>/node_modules/<packageName>/`.
 */
function loadDtsTree(
  assetRoot: string,
  packageName: string,
  virtualEnv: VirtualTSEnvironment,
  packageRoot: string,
  shopifyWebComponents: Set<string>,
  predicate?: (relPath: string) => boolean,
): void {
  for (const { assetPath, relPath } of walkAssetDts(assetRoot, predicate)) {
    const content = readAssetFile(assetPath);
    if (!content) continue;
    addAssetToVirtualEnv(
      virtualEnv,
      packageRoot,
      packageName,
      relPath,
      content,
      shopifyWebComponents,
    );
  }
}

/**
 * Extract component names from a target entry point's imports.
 * e.g. `import "../components/Page.d.ts"` -> "Page"
 */
function extractComponentImports(content: string): string[] {
  const components: string[] = [];
  const importRegex = /import\s+['"]\.\.\/components\/(\w+)\.d\.ts['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    components.push(match[1]);
  }
  return components;
}

/**
 * Target-specific loading for `@shopify/ui-extensions`: only load the
 * components the target actually imports, plus shared/api/types/event
 * helpers and globals. Mirrors the perf shape of the old node_modules-based
 * loader so we don't bring in hundreds of unrelated component files per
 * validation call.
 */
function listAvailableTargets(targetsDirAbs: string): string[] {
  let entries;
  try {
    entries = readdirSync(targetsDirAbs, { withFileTypes: true });
  } catch {
    return [];
  }
  const names = new Set<string>();
  for (const e of entries) {
    if (!e.isFile()) continue;
    const logical = e.name.endsWith(".gz") ? e.name.slice(0, -3) : e.name;
    if (logical.endsWith(".d.ts")) {
      names.add(logical.slice(0, -".d.ts".length));
    }
  }
  return [...names].sort();
}

function loadTargetSpecificComponents(
  assetRoot: string,
  packageName: string,
  virtualEnv: VirtualTSEnvironment,
  packageRoot: string,
  extensionSurfaceName: string,
  extensionTarget: string,
  shopifyWebComponents: Set<string>,
): {
  hasTargetSubpath: boolean;
  invalidTarget?: InvalidTargetInfo;
} {
  const surfaceRel = `build/ts/surfaces/${extensionSurfaceName}`;
  const targetsDirAbs = path.join(assetRoot, surfaceRel, "targets");
  const targetRel = `${surfaceRel}/targets/${extensionTarget}.d.ts`;
  const targetContent = readAssetFile(path.join(assetRoot, targetRel));

  if (!targetContent) {
    // Two distinct sub-cases share the "no per-target d.ts" branch:
    //   (a) The version has no per-target layout at all (React-era, e.g.
    //       `@shopify/ui-extensions@2025.7.4`). The `targets/` directory
    //       itself doesn't exist; the target string isn't a type-narrowing
    //       key. Fall back to whole-surface loading.
    //   (b) The version DOES ship a `targets/` subtree (modern 2025.10+),
    //       but the requested target isn't in it — a typoed or unsupported
    //       target. Signal `invalidTarget` so the caller fails loudly
    //       instead of silently passing against the whole surface tree.
    if (existsSync(targetsDirAbs)) {
      return {
        hasTargetSubpath: false,
        invalidTarget: {
          target: extensionTarget,
          surface: extensionSurfaceName,
          supported: listAvailableTargets(targetsDirAbs),
        },
      };
    }
    loadDtsTree(
      assetRoot,
      packageName,
      virtualEnv,
      packageRoot,
      shopifyWebComponents,
      surfaceMatcher(extensionSurfaceName),
    );
    return { hasTargetSubpath: false };
  }

  // Load the surface entry-point sibling file (e.g. `surfaces/admin.d.ts`)
  // referenced by `typesVersions` / `exports.types` for the
  // `<pkg>/<surface>` subpath. Without it, an import like
  // `@shopify/ui-extensions/admin` falls back to directory resolution and
  // can't resolve types re-exported from the surface barrel — which means
  // chained `import("@shopify/ui-extensions/admin").AdminActionProps`
  // lookups in `@shopify/ui-extensions-react`'s component declarations
  // collapse to `any`.
  const surfaceEntryRel = `${surfaceRel}.d.ts`;
  const surfaceEntryContent = readAssetFile(
    path.join(assetRoot, surfaceEntryRel),
  );
  if (surfaceEntryContent) {
    addAssetToVirtualEnv(
      virtualEnv,
      packageRoot,
      packageName,
      surfaceEntryRel,
      surfaceEntryContent,
      shopifyWebComponents,
    );
  }

  addAssetToVirtualEnv(
    virtualEnv,
    packageRoot,
    packageName,
    targetRel,
    targetContent,
    shopifyWebComponents,
  );

  const componentsRel = `${surfaceRel}/components`;
  for (const componentName of extractComponentImports(targetContent)) {
    const compRel = `${componentsRel}/${componentName}.d.ts`;
    const content = readAssetFile(path.join(assetRoot, compRel));
    if (content) {
      addAssetToVirtualEnv(
        virtualEnv,
        packageRoot,
        packageName,
        compRel,
        content,
        shopifyWebComponents,
      );
    }
  }

  // Component files import shared types from either `./shared` or
  // `./components-shared`. admin ships only `shared.d.ts`; customer-account
  // ships both (a small `shared.d.ts` with prop helpers + a large
  // `components-shared.d.ts`). Load whichever exist.
  for (const sharedFile of ["shared.d.ts", "components-shared.d.ts"]) {
    const sharedRel = `${componentsRel}/${sharedFile}`;
    const sharedContent = readAssetFile(path.join(assetRoot, sharedRel));
    if (sharedContent) {
      addAssetToVirtualEnv(
        virtualEnv,
        packageRoot,
        packageName,
        sharedRel,
        sharedContent,
        shopifyWebComponents,
      );
    }
  }

  for (const sub of ["api", "types", "event"]) {
    const subRel = `${surfaceRel}/${sub}`;
    loadDtsTree(
      assetRoot,
      packageName,
      virtualEnv,
      packageRoot,
      shopifyWebComponents,
      (rel) => rel === subRel || rel.startsWith(`${subRel}/`),
    );
  }

  for (const filename of [
    "extension-targets.d.ts",
    "globals.d.ts",
    "api.d.ts",
    "extension.d.ts",
  ]) {
    const rel = `${surfaceRel}/${filename}`;
    const content = readAssetFile(path.join(assetRoot, rel));
    if (content) {
      addAssetToVirtualEnv(
        virtualEnv,
        packageRoot,
        packageName,
        rel,
        content,
        shopifyWebComponents,
      );
    }
  }

  // Top-level entry-point files at `build/ts/*.d.ts` (api, extension, index,
  // preact, shared). Surface files import these via `../../api`,
  // `../../extension`, etc. — without them TS emits "Cannot find module" even
  // when the surface subtree is fully loaded. Walked shallowly so any new
  // entry-point added upstream is picked up without a code change here.
  loadDtsTree(
    assetRoot,
    packageName,
    virtualEnv,
    packageRoot,
    shopifyWebComponents,
    (rel) => {
      if (!rel.startsWith("build/ts/")) return false;
      const rest = rel.slice("build/ts/".length);
      return rest.endsWith(".d.ts") && !rest.includes("/");
    },
  );

  return { hasTargetSubpath: true };
}

/**
 * Load the types needed to validate a code snippet for `api` at `apiVersion`.
 *
 * Reads `<typesDataDir>/index.json` to discover the `(package, version)` set,
 * then populates the language service's virtual filesystem under synthetic
 * `<packageRoot>/node_modules/<pkg>/...` paths so TS's stock NodeJs module
 * resolution finds them.
 *
 * For versioned APIs without an explicit `apiVersion`, falls back to the
 * entry tagged `latestVersion: true` in supported-versions-schema.json.
 */
export async function loadTypesIntoTSEnv(
  api: ShopifyAPIs,
  apiVersion: string | undefined,
  virtualEnv: VirtualTSEnvironment,
  extensionTarget?: string,
): Promise<LoadTypesResult> {
  const missingPackages: string[] = [];
  const searchedPaths: string[] = [];
  const shopifyWebComponents = new Set<string>();
  let hasTargetSubpath = false;
  let invalidTarget: InvalidTargetInfo | undefined;

  const apiConfig = SHOPIFY_APIS[api];
  const isVersioned = apiConfig?.versioned === true;
  const extensionSurfaceName = apiConfig?.extensionSurfaceName;

  const typesDir = getTypesDataDirectory();
  const index = readIndexJson();
  const apiEntry = index[api] as Record<string, PackageRef[]> | undefined;

  let versionKey: string | undefined;
  if (isVersioned) {
    if (apiVersion) {
      const supported = supportedVersionNames(api);
      if (supported.length > 0 && !supported.includes(apiVersion)) {
        return {
          missingPackages,
          searchedPaths,
          shopifyWebComponents,
          applicablePackageNames: [],
          hasTargetSubpath,
          unsupportedVersion: { requested: apiVersion, supported },
        };
      }
    }
    versionKey = apiVersion ?? resolveLatestVersion(api);
  } else {
    versionKey = "_";
  }

  // Use the resolved version (versionKey for versioned APIs; undefined for
  // unversioned ones — bare-string entries always apply, and tagged entries
  // on unversioned APIs aren't meaningful) when filtering tagged
  // publicPackages entries. Tagged entries with a `versions` constraint that
  // doesn't include the resolved version get dropped here (e.g. React
  // bindings on a web-component-era version).
  const effectiveApiVersion = isVersioned ? versionKey : undefined;
  const applicablePublicEntries = (apiConfig?.publicPackages ?? []).filter(
    (entry) => publicPackageAppliesToVersion(entry, effectiveApiVersion),
  );
  const applicablePackageNames =
    applicablePublicEntries.map(getPublicPackageName);
  const excludedPublicPackageNames = new Set(
    (apiConfig?.publicPackages ?? [])
      .filter(
        (entry) => !publicPackageAppliesToVersion(entry, effectiveApiVersion),
      )
      .map(getPublicPackageName),
  );

  // Defense in depth against a stale or hand-edited index.json: drop refs
  // that name a publicPackage which doesn't apply to this version. Refs
  // that aren't in publicPackages at all (transitive deps brought in by the
  // extraction recipe — e.g. @remote-ui/*) pass through untouched.
  const rawApiPackages: PackageRef[] = versionKey
    ? (apiEntry?.[versionKey] ?? [])
    : [];
  const apiPackages: PackageRef[] = rawApiPackages.filter(
    (ref) => !excludedPublicPackageNames.has(ref.package),
  );

  // If the API config says we expect packages but the index returned none,
  // surface the configured public packages (filtered to those that apply to
  // this version) as missing so the caller can produce a useful error.
  if (apiPackages.length === 0 && applicablePublicEntries.length > 0) {
    for (const entry of applicablePublicEntries) {
      const pkg = getPublicPackageName(entry);
      missingPackages.push(pkg);
      searchedPaths.push(
        path.join(typesDir, pkg, versionKey ?? "<unknown-version>"),
      );
    }
  }

  const alwaysLoaded = index._always_loaded ?? [];
  const allPackages: PackageRef[] = [...apiPackages, ...alwaysLoaded];

  const packageRoot = virtualEnv.servicesHost.getCurrentDirectory();

  for (const { package: pkg, version } of allPackages) {
    const assetRoot = path.join(typesDir, pkg, version);
    if (!existsSync(assetRoot)) {
      missingPackages.push(pkg);
      searchedPaths.push(assetRoot);
      continue;
    }

    const pkgJsonContent = readAssetFile(path.join(assetRoot, "package.json"));
    if (pkgJsonContent) {
      addAssetToVirtualEnv(
        virtualEnv,
        packageRoot,
        pkg,
        "package.json",
        pkgJsonContent,
      );
    }

    // Synthesize nested package.json files for split-entry-point packages
    // (e.g. `preact/jsx-runtime/package.json`). The shipped asset tree only
    // includes the top-level package.json, but legacy NodeJs resolution needs
    // nested ones to resolve subpath imports like `import "preact/jsx-runtime"`.
    synthesizeNestedPackageJsons(assetRoot, pkg, virtualEnv, packageRoot);

    if (pkg === "@shopify/ui-extensions" && extensionSurfaceName) {
      if (extensionTarget) {
        const targetResult = loadTargetSpecificComponents(
          assetRoot,
          pkg,
          virtualEnv,
          packageRoot,
          extensionSurfaceName,
          extensionTarget,
          shopifyWebComponents,
        );
        hasTargetSubpath = targetResult.hasTargetSubpath;
        if (targetResult.invalidTarget) {
          invalidTarget = targetResult.invalidTarget;
        }
      } else {
        loadDtsTree(
          assetRoot,
          pkg,
          virtualEnv,
          packageRoot,
          shopifyWebComponents,
          surfaceMatcher(extensionSurfaceName),
        );
      }
    } else if (pkg === "@shopify/ui-extensions-react" && extensionSurfaceName) {
      // The React bindings tarball is deduped across all four UI surfaces, so
      // its asset root holds checkout/admin/customer-account/point-of-sale
      // subtrees side-by-side. Without this filter, validating a checkout
      // extension would also pull in admin / POS / customer-account React
      // types and inflate the virtual env.
      loadDtsTree(
        assetRoot,
        pkg,
        virtualEnv,
        packageRoot,
        shopifyWebComponents,
        surfaceMatcher(extensionSurfaceName),
      );
    } else {
      loadDtsTree(
        assetRoot,
        pkg,
        virtualEnv,
        packageRoot,
        shopifyWebComponents,
      );
    }

    if (pkg === "@shopify/app-bridge-types") {
      // app-bridge-types augments the *global* JSX namespace, but the
      // virtual env is configured with jsxImportSource: "preact" so the
      // type checker only consults preact's JSX namespace. Without this
      // shim, every <ui-modal> / <ui-title-bar> / <ui-save-bar> /
      // <ui-nav-menu> in user code fails type-check with "Property
      // 'ui-modal' does not exist on type 'JSX.IntrinsicElements'" even
      // though the type is loaded. Re-apply the augmentation to preact's
      // JSX namespace, mirroring how @shopify/polaris-types ships its
      // intrinsics.
      addAppBridgePreactJSXShim(virtualEnv);
    }
  }

  return {
    missingPackages,
    searchedPaths,
    shopifyWebComponents,
    applicablePackageNames,
    hasTargetSubpath,
    invalidTarget,
  };
}

/**
 * Inject an ambient .d.ts that re-applies @shopify/app-bridge-types'
 * IntrinsicElements augmentation to preact's JSX namespace.
 *
 * Why this is needed: app-bridge-types declares its custom elements as
 *   declare global { namespace JSX { interface IntrinsicElements
 *     extends AppBridgeElements {} } }
 * but the validator's virtual TS env runs with jsxImportSource: "preact"
 * (see createVirtualTSEnvironment.ts). preact's JSX lives at
 * 'preact'.createElement.JSX, not at the global JSX namespace, so the
 * global augmentation is invisible to the type checker. @shopify/polaris-types
 * targets the right namespace already; this shim is the App-Bridge half
 * of the same pattern.
 *
 * Path is a fake-but-deterministic file inside the virtual env so the
 * language service treats it as a real ambient module declaration.
 */
function addAppBridgePreactJSXShim(virtualEnv: VirtualTSEnvironment): void {
  // The shim must live somewhere the virtual env's module resolution can
  // reach @shopify/app-bridge-types from. The virtual env's effective
  // "package root" is computed by createVirtualTSEnvironment.getPackageRoot
  // as `path.resolve(fileURLToPath(import.meta.url), "../..")` — which,
  // because `fileURLToPath` returns a file path (not a directory), resolves
  // to <package>/src, not <package>. All loaded packages therefore live
  // under <package>/src/node_modules/<pkg>/...
  //
  // We deliberately mirror that same computation here so the shim ends up
  // at <package>/src/__shims__/, alongside the loaded packages, where
  // upward node-module resolution can find @shopify/app-bridge-types.
  // Adding `path.dirname(...)` here without also fixing
  // createVirtualTSEnvironment moves the shim above the synthesized
  // node_modules tree and the import fails.
  const currentDir = fileURLToPath(import.meta.url);
  const packageRoot = path.resolve(currentDir, "../..");
  const shimPath = path.join(
    packageRoot,
    "__shims__",
    "app-bridge-preact-jsx.d.ts",
  );
  const shimContent = [
    `import type { AppBridgeElements } from "@shopify/app-bridge-types/dist/shopify";`,
    `declare module "preact" {`,
    `  namespace createElement.JSX {`,
    `    interface IntrinsicElements extends AppBridgeElements {}`,
    `  }`,
    `}`,
    ``,
  ].join("\n");
  addFileToVirtualEnv(virtualEnv, shimPath, shimContent);
}

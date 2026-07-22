#!/usr/bin/env node

import { execSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  readFileSync,
  renameSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, "..");
const MONOREPO_ROOT = path.resolve(PACKAGE_ROOT, "../..");
const DATA_DIR =
  process.env.UPDATE_APIS_DATA_DIR || path.join(PACKAGE_ROOT, "src/data");
const DEFAULT_SHOPIFY_DEV_PATH = path.join(
  process.env.HOME,
  "world/trees/root/src/areas/platforms/shopify-dev",
);
const RAW_SCHEMA_DIR = "db/data/docs/graphql/raw";
const OFFLINE_SCOPES_SCRIPT =
  "scripts/graphql-offline-scopes/generate-offline-scopes.ts";
const OFFLINE_SCOPES_OUTPUT_DIR = "scripts/graphql-offline-scopes/output";

const DEV_MCP_PACKAGES = [
  "@shopify/theme-check-common",
  "@shopify/theme-check-docs-updater",
  "@shopify/theme-check-node",
];

// Per-npm-package extraction recipes (Part 3). Keyed by the npm package name
// that appears in a SHOPIFY_APIS entry's publicPackages. Each recipe knows the
// package's tarball layout — what subtree holds its .d.ts files and (for
// hydrogen) which transitive deps must be chased. The set of APIs that need
// extraction, and the per-API surface filter, are derived from SHOPIFY_APIS at
// runtime; this map only carries information that depends on the npm package's
// internal layout.
//
// Keep in sync with packages/shopify-dev-tools/src/validation/
// loadTypesIntoTSEnv.ts — same set of files, same shape.
const PACKAGE_EXTRACTION_RECIPES = {
  "@shopify/ui-extensions": {
    // Surface (admin/checkout/customer-account/point-of-sale) comes from each
    // API's extensionSurfaceName. Same tarball is shared across APIs; include
    // paths are merged per (pkg, version).
    //
    // Both the surface subtree and the sibling `<surface>.d.ts` entry-point
    // file (referenced by `typesVersions` / `exports.types` in the package.json)
    // are pulled — without the sibling file, TypeScript cannot resolve bare
    // surface imports like `import { Banner } from '@shopify/ui-extensions/admin'`.
    surfaceSubpath: (surface) => [
      path.join("build", "ts", "surfaces", surface),
      path.join("build", "ts", "surfaces", `${surface}.d.ts`),
    ],
    // Top-level entry-point .d.ts files at build/ts/*.d.ts (api, extension,
    // index, preact, shared) — referenced by surface .d.ts files via relative
    // imports (e.g. `../extension`, `../shared`). Without them TypeScript
    // emits "Cannot find module" when resolving cross-file types. Scanned
    // shallowly so sibling subtrees (other surfaces, docs/) are not pulled in.
    shallowSubpaths: [path.join("build", "ts")],
  },
  "@shopify/ui-extensions-react": {
    // React bindings package. Surface layout mirrors @shopify/ui-extensions
    // (build/ts/surfaces/<surface>/...). Pinned to a single version because
    // the package doesn't currently publish per-apiVersion dist-tags.
    pinnedVersion: "2025.7.4",
    surfaceSubpath: (surface) => [
      path.join("build", "ts", "surfaces", surface),
      path.join("build", "ts", "surfaces", `${surface}.d.ts`),
    ],
    // Transitive .d.ts closure for the React bindings. Bare-string entries
    // are direct deps declared in @shopify/ui-extensions-react's
    // package.json — resolveSemverRange honors that range.
    //
    // Tagged entries (`{ name, pinnedVersion }`) are deeper deps that the
    // React bindings .d.ts files reference but @shopify/ui-extensions-react
    // does *not* list. expandPackageExtraction only reads the parent's
    // package.json, so without a pin these would fall back to the `latest`
    // dist-tag — which is currently outside the *deep* declared range for
    // @types/react-reconciler (@remote-ui/react@5.0.8 wants
    // `>=0.26.0 <0.30.0`; latest is 0.33.x). The @remote-ui/* pins match
    // current `latest`; they exist so a future upstream release that's
    // incompatible with @remote-ui/react's declared ranges can't silently
    // land in the extracted types.
    transitiveDeps: [
      "@remote-ui/react",
      "@remote-ui/async-subscription",
      { name: "@remote-ui/core", pinnedVersion: "2.2.7" },
      { name: "@remote-ui/rpc", pinnedVersion: "1.4.7" },
      { name: "@remote-ui/types", pinnedVersion: "1.1.3" },
      { name: "@types/react-reconciler", pinnedVersion: "0.28.9" },
    ],
  },
  "@shopify/hydrogen": {
    includeSubpaths: ["dist"],
    // Hydrogen's runtime needs these transitive packages too. Resolved from
    // each extracted hydrogen tarball's package.json (so versions track
    // upstream); copied with the "all-dts" mode since each dep's .d.ts layout
    // differs.
    transitiveDeps: [
      "@shopify/hydrogen-react",
      "react-router",
      "@react-router/dev",
      "graphql",
      "type-fest",
      "schema-dts",
    ],
  },
  "@shopify/polaris-types": { includeSubpaths: ["dist"] },
  "@shopify/app-bridge-types": { includeSubpaths: ["dist"] },
  "@shopify/app-bridge-react": { includeSubpaths: ["build/types"] },
};

// Packages loadTypesIntoTSEnv always pulls in regardless of API. Bare-string
// entries are extracted once per script run at the `latest` dist-tag. Tagged
// entries (`{ name, pinnedVersion }`) lock to a specific version: @types/react
// is pinned to 18.x because the React bindings closure (@remote-ui/react)
// declares `@types/react: >=17.0.0 <19.0.0`; npm's `latest` dist-tag is now
// on 19.x, which would otherwise drift the virtual TS env outside that range.
const ALWAYS_LOADED_TYPE_PACKAGES = [
  "preact",
  { name: "@types/react", pinnedVersion: "18.3.29" },
];

// `publicPackages` entries are either bare strings or `{ name, versions }`
// tagged objects. These two helpers normalize both shapes — kept inline rather
// than imported so the script doesn't depend on additional named exports from
// the api-mapping module (which is dynamic-imported and stubbed in tests).
// Keep in sync with `getPublicPackageName` / `publicPackageAppliesToVersion`
// in packages/shopify-dev-tools/src/types/api-mapping.ts.
function getPublicPackageName(entry) {
  return typeof entry === "string" ? entry : entry.name;
}
function publicPackageAppliesToVersion(entry, apiVersion) {
  if (typeof entry === "string") return true;
  if (!entry.versions) return true;
  if (apiVersion === undefined) return true;
  return entry.versions.includes(apiVersion);
}

const NPM_REGISTRY = "https://registry.npmjs.org";
const TYPES_DIR_NAME = "types";
const TYPES_INDEX_FILENAME = "index.json";

const API_VERSIONS_URL = "https://shopify.dev/api-versions.json";
const SUPPORTED_VERSIONS_FILENAME = "supported-versions-schema.json";

// Maps a key from shopify.dev's /api-versions.json to the dev-mcp API key it
// represents. Most entries map one endpoint key to one dev-mcp key. The `functions`
// entry is special: the endpoint nests per-API version data under `functions.apis`,
// so its value is an object mapping each kebab-case sub-key (e.g. `cart-transform`,
// `order-discount`) to its dev-mcp counterpart (e.g. `functions_order_discounts`).
const API_VERSIONS_KEY_MAP = {
  // GraphQL APIs
  "admin-graphql": "admin",
  storefront: "storefront-graphql",
  partner: "partner",
  customer: "customer",
  "payments-apps": "payments-apps",
  // UI framework APIs (templated docs)
  "app-home": "polaris-app-home",
  "admin-extensions": "polaris-admin-extensions",
  "checkout-ui-extensions": "polaris-checkout-extensions",
  "customer-account-ui-extensions": "polaris-customer-account-extensions",
  "pos-ui-extensions": "pos-ui",
  hydrogen: "hydrogen",
  "storefront-web-components": "storefront-web-components",
  // Functions: per-API version data lives under endpoint.functions.apis.<sub-key>.
  // Sub-keys are kebab-case; some are singular on the endpoint (`order-discount`)
  // while their dev-mcp counterparts are plural (`functions_order_discounts`).
  functions: {
    "cart-and-checkout-validation": "functions_cart_checkout_validation",
    "cart-transform": "functions_cart_transform",
    "delivery-customization": "functions_delivery_customization",
    discount: "functions_discount",
    "discounts-allocator": "functions_discounts_allocator",
    "fulfillment-constraints": "functions_fulfillment_constraints",
    "local-pickup-delivery-option-generator":
      "functions_local_pickup_delivery_option_generator",
    "order-discount": "functions_order_discounts",
    "order-routing-location-rule": "functions_order_routing_location_rule",
    "payment-customization": "functions_payment_customization",
    "pickup-point-delivery-option-generator":
      "functions_pickup_point_delivery_option_generator",
    "product-discount": "functions_product_discounts",
    "shipping-discount": "functions_shipping_discounts",
  },
};

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    version: null,
    shopifyDevPath: DEFAULT_SHOPIFY_DEV_PATH,
    snapshot: false,
    yes: false,
    schemasOnly: false,
    versionsOnly: false,
    typesOnly: false,
    skipVersions: false,
    internal: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--version":
        opts.version = args[++i];
        break;
      case "--shopify-dev":
        opts.shopifyDevPath = args[++i];
        break;
      case "--snapshot":
        opts.snapshot = true;
        break;
      case "--yes":
      case "-y":
        opts.yes = true;
        break;
      case "--schemas-only":
        opts.schemasOnly = true;
        break;
      case "--versions-only":
        opts.versionsOnly = true;
        break;
      case "--types-only":
        opts.typesOnly = true;
        break;
      case "--skip-versions":
        opts.skipVersions = true;
        break;
      case "--internal":
        opts.internal = true;
        break;
      case "--help":
      case "-h":
        printUsage();
        process.exit(0);
      default:
        console.error(`Unknown argument: ${args[i]}`);
        printUsage();
        process.exit(1);
    }
  }

  return opts;
}

function printUsage() {
  console.log(`
Usage: node scripts/update-apis.mjs [options]

supported-versions-schema.json (refreshed from shopify.dev/api-versions.json
in Part 0) is the single source of truth for which versions to copy. Catalog
mode copies every listed version, including release candidates. --version
copies a single listed version. Locally bundled versions no longer in the
catalog are deleted.

Options:
  --version <ver>        Single-version mode: copy only this version per API,
                         validated against supported-versions-schema.json.
                         APIs that don't list <ver> are skipped. Skips stale
                         cleanup. Useful for ad-hoc snapshot/RC testing.
  --shopify-dev <path>   Override shopify-dev repo path
                         (default: ~/world/trees/root/src/areas/platforms/shopify-dev)
  --snapshot             Also consider snapshot/prerelease versions when bumping theme-check
  --schemas-only         Only update GraphQL schemas, skip everything else
  --types-only           Only extract UI type assets, skip everything else
  --versions-only        Only refresh supported-versions-schema.json from /api-versions.json
  --skip-versions        Skip the supported-versions refresh; use the existing
                         supported-versions-schema.json on disk as-is. Useful
                         offline and in tests.
  --internal             Include internal APIs (requires internal module to be built)
  -y, --yes              Skip confirmation prompts
  -h, --help             Show this help message
`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg) {
  console.log(msg);
}

function warn(msg) {
  console.log(`\x1b[33m⚠ ${msg}\x1b[0m`);
}

function success(msg) {
  console.log(`\x1b[32m✓ ${msg}\x1b[0m`);
}

function error(msg) {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`);
}

function heading(msg) {
  console.log(`\n\x1b[1m\x1b[36m${msg}\x1b[0m`);
}

async function confirm(message) {
  const { createInterface } = await import("node:readline");
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(`${message} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}

// ---------------------------------------------------------------------------
// Part 0: Build supported-versions-schema.json from /api-versions.json
// ---------------------------------------------------------------------------

async function fetchApiVersions() {
  const res = await fetch(API_VERSIONS_URL);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch ${API_VERSIONS_URL}: ${res.status} ${res.statusText}`,
    );
  }
  return res.json();
}

function buildVersionEntries(endpointEntry, endpointKey) {
  if (endpointEntry === undefined) {
    throw new Error(
      `Missing API "${endpointKey}" in ${API_VERSIONS_URL} response. ` +
        `This key is required by API_VERSIONS_KEY_MAP. ` +
        `Either the upstream endpoint (/api-versions.json in the shopify-dev repo) changed (investigate) ` +
        `or the map is stale (update).`,
    );
  }
  const available = endpointEntry?.available;
  if (!Array.isArray(available) || available.length === 0) return [];
  const stable = endpointEntry?.stable ?? null;
  const rc = endpointEntry?.rc ?? null;
  // When only one version is available, tag it as latest regardless of stable
  // (e.g. APIs that only expose `unstable`).
  if (available.length === 1) {
    const entry = { name: available[0], latestVersion: true };
    if (available[0] === rc) entry.releaseCandidate = true;
    return [entry];
  }
  return available.map((name) => {
    const entry = { name };
    if (name === stable) entry.latestVersion = true;
    if (name === rc) entry.releaseCandidate = true;
    return entry;
  });
}

async function writeSupportedVersions() {
  heading(
    `Part 0: Build ${SUPPORTED_VERSIONS_FILENAME} from /api-versions.json`,
  );

  log(`Fetching ${API_VERSIONS_URL}...`);
  let endpoint;
  try {
    endpoint = await fetchApiVersions();
  } catch (e) {
    error(e.message);
    return false;
  }

  const configPath = path.join(DATA_DIR, SUPPORTED_VERSIONS_FILENAME);
  const next = {};

  for (const [endpointKey, mcpMapping] of Object.entries(
    API_VERSIONS_KEY_MAP,
  )) {
    if (typeof mcpMapping === "string") {
      next[mcpMapping] = buildVersionEntries(
        endpoint[endpointKey],
        endpointKey,
      );
      continue;
    }

    // Object value: read per-API version data from endpoint[endpointKey].apis.
    const subEndpoint = endpoint[endpointKey];
    if (!subEndpoint || typeof subEndpoint.apis !== "object") {
      throw new Error(
        `Expected nested "apis" object under "${endpointKey}" in ${API_VERSIONS_URL} response. ` +
          `Either the upstream endpoint changed (investigate) or the map is stale (update).`,
      );
    }
    for (const [subKey, mcpKey] of Object.entries(mcpMapping)) {
      next[mcpKey] = buildVersionEntries(
        subEndpoint.apis[subKey],
        `${endpointKey}.apis.${subKey}`,
      );
    }
  }

  writeFileSync(configPath, JSON.stringify(next, null, 2) + "\n");
  success(`Wrote ${path.basename(configPath)}`);
  return true;
}

// ---------------------------------------------------------------------------
// Part 1: GraphQL Schema Update
// ---------------------------------------------------------------------------

function readSupportedVersions() {
  const configPath = path.join(DATA_DIR, SUPPORTED_VERSIONS_FILENAME);
  if (!existsSync(configPath)) {
    throw new Error(
      `${SUPPORTED_VERSIONS_FILENAME} not found at ${configPath}. ` +
        `Run without --skip-versions to refresh it from shopify.dev/api-versions.json first.`,
    );
  }
  return JSON.parse(readFileSync(configPath, "utf-8"));
}

function buildSourcePath(rawDir, prefix, version) {
  const isFunction = prefix.startsWith("functions_");

  if (isFunction) {
    // Function schemas: {prefix}_{version}_public.json
    const publicPath = path.join(rawDir, `${prefix}_${version}_public.json`);
    if (existsSync(publicPath)) return publicPath;

    // Some function schemas may not have _public suffix
    const plainPath = path.join(rawDir, `${prefix}_${version}.json`);
    if (existsSync(plainPath)) return plainPath;

    return null;
  }

  // Non-function schemas: {prefix}_{version}.json
  const filePath = path.join(rawDir, `${prefix}_${version}.json`);
  return existsSync(filePath) ? filePath : null;
}

function fixExistingFilenames() {
  const files = readdirSync(DATA_DIR);
  const renames = [];

  for (const file of files) {
    if (!file.includes("_schema_")) continue;
    if (file === "supported-versions-schema.json") continue;

    // Strip _schema from the filename to match the API key pattern
    const newName = file.replace("_schema_", "_");
    const oldPath = path.join(DATA_DIR, file);
    const newPath = path.join(DATA_DIR, newName);

    if (existsSync(newPath)) {
      warn(`Target already exists, skipping rename: ${file} → ${newName}`);
      continue;
    }

    renames.push({ oldPath, newPath, oldName: file, newName });
  }

  return renames;
}

function findStaleSchemaFiles(apiName, supportedVersionNames) {
  const files = readdirSync(DATA_DIR);
  const supported = new Set(supportedVersionNames);
  const stale = [];

  // Match `{apiName}_{version}.json` or `.json.gz`.
  const re = new RegExp(`^${apiName}_(.+?)\\.json(\\.gz)?$`);

  for (const file of files) {
    const m = file.match(re);
    if (!m) continue;
    const version = m[1];
    if (supported.has(version)) continue;
    stale.push(path.join(DATA_DIR, file));
  }

  return stale;
}

async function generateOfflineScopes(shopifyDevPath, version) {
  const scriptPath = path.join(shopifyDevPath, OFFLINE_SCOPES_SCRIPT);
  if (!existsSync(scriptPath)) {
    warn("Offline scopes script not found in shopify-dev, skipping");
    return null;
  }

  const rawSchemaPath = path.join(RAW_SCHEMA_DIR, `admin_${version}.json`);

  log(`  Running offline scopes generator for admin_${version}...`);

  try {
    execSync(`pnpx tsx ${OFFLINE_SCOPES_SCRIPT} ${rawSchemaPath}`, {
      cwd: shopifyDevPath,
      stdio: "pipe",
      timeout: 120_000,
    });
  } catch (e) {
    warn(`Offline scopes generation failed: ${e.message}`);
    return null;
  }

  const outputPath = path.join(
    shopifyDevPath,
    OFFLINE_SCOPES_OUTPUT_DIR,
    `offline-scopes-admin_${version}.json`,
  );

  if (!existsSync(outputPath)) {
    warn(`Offline scopes output not found at ${outputPath}`);
    return null;
  }

  return JSON.parse(readFileSync(outputPath, "utf-8"));
}

function mergeOfflineScopes(schemaPath, offlineScopes) {
  const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
  schema.offline_scopes = offlineScopes;
  writeFileSync(schemaPath, JSON.stringify(schema));
  success("  Merged offline_scopes into admin schema");
}

/**
 * Build the schema copy plan.
 *
 * @param rawDir          shopify-dev raw schema directory
 * @param schemaMap       { shopifyDevPrefix → dev-mcp API name }
 * @param versionsForApi  (apiName) => [{ name, isLatest }]
 * @param strict          When true (catalog mode), missing source on disk
 *                        throws. When false (single-version mode), warn and
 *                        skip — the user is testing ad-hoc and missing
 *                        sources are expected.
 */
function buildCopyPlan(
  rawDir,
  schemaMap,
  versionsForApi,
  { strict = true } = {},
) {
  const copyPlan = [];

  for (const [shopifyDevKey, schemaKey] of Object.entries(schemaMap)) {
    const versions = versionsForApi(schemaKey);
    if (!Array.isArray(versions) || versions.length === 0) {
      warn(`No supported versions listed for ${schemaKey}, skipping`);
      continue;
    }

    for (const { name: versionId, isLatest } of versions) {
      const sourcePath = buildSourcePath(rawDir, shopifyDevKey, versionId);

      if (!sourcePath) {
        if (strict) {
          throw new Error(
            `No source schema found for ${schemaKey}@${versionId} in ${rawDir}. ` +
              `The catalog lists this version but shopify-dev doesn't have the file. ` +
              `Either pull the latest shopify-dev or remove ${versionId} from supported-versions-schema.json.`,
          );
        }
        warn(`No source on disk for ${schemaKey}@${versionId}, skipping`);
        continue;
      }

      const destFilename = `${schemaKey}_${versionId}.json`;
      copyPlan.push({
        apiName: schemaKey,
        version: versionId,
        sourcePath,
        destPath: path.join(DATA_DIR, destFilename),
        destFilename,
        isLatest,
      });
    }
  }

  return copyPlan;
}

function summarizeCopyPlan(copyPlan) {
  const byApi = new Map();
  for (const item of copyPlan) {
    if (!byApi.has(item.apiName)) byApi.set(item.apiName, []);
    byApi
      .get(item.apiName)
      .push(item.isLatest ? `${item.version} (latest)` : item.version);
  }
  return byApi;
}

async function updateSchemas(opts, schemaMap) {
  heading("Part 1: GraphQL Schema Update");

  const shopifyDevPath = opts.shopifyDevPath;
  const rawDir = path.join(shopifyDevPath, RAW_SCHEMA_DIR);

  // Validate paths
  if (!existsSync(shopifyDevPath)) {
    error(`shopify-dev not found at: ${shopifyDevPath}`);
    error("Use --shopify-dev <path> to specify the correct location");
    return false;
  }

  if (!existsSync(rawDir)) {
    error(`Raw schema directory not found: ${rawDir}`);
    return false;
  }

  // Fix existing naming inconsistencies first
  heading("Fixing existing filename inconsistencies");
  const renames = fixExistingFilenames();

  if (renames.length > 0) {
    for (const { oldName, newName } of renames) {
      log(`  ${oldName} → ${newName}`);
    }

    if (!opts.yes) {
      const ok = await confirm(`Rename ${renames.length} files?`);
      if (!ok) {
        warn("Skipping renames");
        return false;
      }
    }

    for (const { oldPath, newPath, newName } of renames) {
      renameSync(oldPath, newPath);
      success(`  Renamed to ${newName}`);
    }
  } else {
    log("  No naming inconsistencies found");
  }

  // Build copy plan
  heading("Planning schema copies");

  // The catalog (supported-versions-schema.json) is the single source of truth
  // for which versions exist. Both modes read from it:
  //
  //   Catalog mode (default): copy every listed version, including release
  //     candidates. The runtime resolver in api-versions.ts exposes RCs too,
  //     so developers can opt in by name; latestVersion remains the default.
  //
  //   Single-version mode (--version X): copy only X, validated against the
  //     catalog per-API. APIs that don't list X are skipped.
  let supportedVersions;
  try {
    supportedVersions = readSupportedVersions();
  } catch (e) {
    error(e.message);
    return false;
  }

  let versionsForApi;
  let supportedVersionsForApi = null;

  if (opts.version) {
    log(`Single-version mode: ${opts.version} (--version override)`);
    versionsForApi = (apiName) => {
      const versions = supportedVersions[apiName] ?? [];
      if (versions.length === 0) {
        warn(
          `${apiName}: no entry in supported-versions-schema.json, skipping`,
        );
        return [];
      } else if (!versions.some((v) => v.name === opts.version)) {
        warn(
          `${apiName}: ${
            opts.version
          } not in supported-versions-schema.json (listed: ${versions
            .map((v) => v.name)
            .join(", ")}), skipping`,
        );
        return [];
      }
      return [{ name: opts.version }];
    };
  } else {
    log(`Catalog mode: driven by ${SUPPORTED_VERSIONS_FILENAME}`);

    versionsForApi = (apiName) =>
      (supportedVersions[apiName] ?? []).map((v) => ({
        name: v.name,
        isLatest: !!v.latestVersion,
      }));
    supportedVersionsForApi = Object.fromEntries(
      Object.values(schemaMap).flatMap((apiName) => {
        const versions = supportedVersions[apiName];
        return Array.isArray(versions) && versions.length > 0
          ? [[apiName, versions.map((v) => v.name)]]
          : [];
      }),
    );
  }

  const copyPlan = buildCopyPlan(rawDir, schemaMap, versionsForApi, {
    strict: !opts.version,
  });

  // Display plan
  if (copyPlan.length === 0) {
    log("  No new schema copies needed");
  } else {
    heading("Schema update plan");
    for (const [apiName, versions] of summarizeCopyPlan(copyPlan)) {
      log(`  ${apiName}: ${versions.join(", ")}`);
    }

    if (!opts.yes) {
      const ok = await confirm(`Copy ${copyPlan.length} schemas?`);
      if (!ok) {
        warn("Aborted");
        return false;
      }
    }

    // Execute copies. Clear the matching .gz so compress-json regenerates it
    // (compress-json's `if (.gz exists) skip` would otherwise leave stale data).
    heading("Copying schemas");
    for (const item of copyPlan) {
      copyFileSync(item.sourcePath, item.destPath);
      const gzPath = `${item.destPath}.gz`;
      if (existsSync(gzPath)) unlinkSync(gzPath);
      success(`  ${item.destFilename}`);
    }

    // Offline scopes for every admin version copied
    const adminEntries = copyPlan.filter((e) => e.apiName === "admin");
    if (adminEntries.length > 0) {
      heading("Generating offline scopes for admin");
      for (const adminEntry of adminEntries) {
        const adminSchema = JSON.parse(
          readFileSync(adminEntry.destPath, "utf-8"),
        );

        if (adminSchema.offline_scopes) {
          log(`  admin@${adminEntry.version}: already has offline_scopes`);
          continue;
        }

        const offlineScopes = await generateOfflineScopes(
          shopifyDevPath,
          adminEntry.version,
        );
        if (offlineScopes) {
          mergeOfflineScopes(adminEntry.destPath, offlineScopes);
        } else {
          warn(
            `  admin@${adminEntry.version}: could not generate offline scopes — schema will lack scope data`,
          );
        }
      }
    }
  }

  // Stale cleanup — only in catalog mode. Single-version overrides shouldn't
  // delete other versions that are still legitimately supported.
  if (supportedVersionsForApi) {
    heading("Cleaning up stale schemas");
    let deletedAny = false;
    for (const apiName of Object.keys(supportedVersionsForApi)) {
      const stale = findStaleSchemaFiles(
        apiName,
        supportedVersionsForApi[apiName],
      );
      for (const f of stale) {
        unlinkSync(f);
        success(`  Deleted ${path.basename(f)}`);
        deletedAny = true;
      }
    }
    if (!deletedAny) log("  No stale schema files found");
  }

  // Compress
  heading("Compressing schemas");
  try {
    execSync("pnpm run compress-json", {
      cwd: PACKAGE_ROOT,
      stdio: "inherit",
    });
  } catch (e) {
    error(`Compression failed: ${e.message}`);
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Part 2: TS Package Update
// ---------------------------------------------------------------------------

function getDistTags(pkg) {
  try {
    const output = execSync(`pnpm view ${pkg} dist-tags --json`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30_000,
    });
    return JSON.parse(output);
  } catch (e) {
    warn(`Could not fetch dist-tags for ${pkg}: ${e.message}`);
    return null;
  }
}

function semverCompare(a, b) {
  const cleanA = a.replace(/^[^0-9]*/, "");
  const cleanB = b.replace(/^[^0-9]*/, "");
  const partsA = cleanA.split(/[.-]/).map((p) => (isNaN(p) ? p : Number(p)));
  const partsB = cleanB.split(/[.-]/).map((p) => (isNaN(p) ? p : Number(p)));

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const pa = partsA[i] ?? 0;
    const pb = partsB[i] ?? 0;

    if (typeof pa === "number" && typeof pb === "number") {
      if (pa !== pb) return pa - pb;
    } else {
      const sa = String(pa);
      const sb = String(pb);
      if (sa !== sb) return sa.localeCompare(sb);
    }
  }
  return 0;
}

function resolvePackageVersion(pkg, currentVersion, useSnapshot) {
  const tags = getDistTags(pkg);
  if (!tags) return null;

  if (useSnapshot && tags.snapshot) {
    if (semverCompare(tags.snapshot, currentVersion) > 0) {
      return { version: tags.snapshot, source: "snapshot" };
    }
  }

  if (tags.latest && semverCompare(tags.latest, currentVersion) > 0) {
    return { version: tags.latest, source: "latest" };
  }

  return null;
}

function updatePackageJsonDep(pkgJsonPath, dep, newVersion) {
  const content = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
  let updated = false;

  for (const section of ["dependencies", "devDependencies"]) {
    if (content[section]?.[dep] && content[section][dep] !== "catalog:") {
      content[section][dep] = newVersion;
      updated = true;
    }
  }

  if (updated) {
    writeFileSync(pkgJsonPath, JSON.stringify(content, null, 2) + "\n");
  }
  return updated;
}

/**
 * Bump theme-check runtime dependencies in this package.
 *
 * UI type packages used to be bumped here too (in pnpm-workspace.yaml's
 * catalog) so that loadTypesIntoTSEnv could resolve them at runtime via
 * findNPMPackageBasePath. They no longer need to be — UI types are now
 * extracted as static assets by --types-only, so the npm tree in node_modules
 * is no longer authoritative for them. The theme-check packages are different:
 * they are direct runtime imports, so they stay here as real npm dependencies
 * that need occasional version bumps.
 */
async function updateLiquidPackages(opts) {
  heading("Part 2: Liquid (theme-check) Package Bumps");

  const packageJsonPath = path.join(PACKAGE_ROOT, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

  const updates = [];

  for (const pkg of DEV_MCP_PACKAGES) {
    const currentVersion =
      packageJson.dependencies?.[pkg] || packageJson.devDependencies?.[pkg];
    if (!currentVersion || currentVersion === "catalog:") {
      warn(`${pkg} not found as a direct dependency of shopify-dev-tools`);
      continue;
    }

    log(`  ${pkg}: current ${currentVersion}`);
    const result = resolvePackageVersion(pkg, currentVersion, opts.snapshot);

    if (result) {
      updates.push({
        pkg,
        current: currentVersion,
        next: result.version,
        source: result.source,
      });
      log(`    → ${result.version} (${result.source})`);
    } else {
      log(`    → up to date`);
    }
  }

  if (updates.length === 0) {
    log("\nAll theme-check packages are up to date");
    return true;
  }

  heading("Theme-check package update plan");
  for (const u of updates) {
    log(`  ${u.pkg}: ${u.current} → ${u.next} (${u.source})`);
  }

  if (!opts.yes) {
    const ok = await confirm(`Update ${updates.length} theme-check packages?`);
    if (!ok) {
      warn("Aborted");
      return false;
    }
  }

  heading("Applying theme-check updates");
  for (const u of updates) {
    if (updatePackageJsonDep(packageJsonPath, u.pkg, u.next)) {
      success(`  Updated ${u.pkg} in shopify-dev-tools/package.json`);
    } else {
      warn(`  Could not update ${u.pkg} in shopify-dev-tools/package.json`);
    }
  }

  heading("Running pnpm install");
  try {
    execSync("pnpm install", {
      cwd: MONOREPO_ROOT,
      stdio: "inherit",
      timeout: 120_000,
    });
    success("pnpm install complete");
  } catch (e) {
    warn(`pnpm install had issues: ${e.message}`);
    warn("You may need to run 'pnpm install' manually");
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Part 3: UI Type Asset Extraction
// ---------------------------------------------------------------------------
//
// For each (apiName, apiVersion) listed in supported-versions-schema.json, fetch
// the matching npm tarball, extract just the .d.ts files loadTypesIntoTSEnv.ts
// needs, and write them under DATA_DIR/types/<pkg>/<npmVersion>/. Emit an
// index.json mapping (apiName, apiVersion) → packages so the consumer can find
// the right tree without re-resolving npm at runtime.
//
// Which APIs need extraction and what surface they want is read from
// SHOPIFY_APIS at runtime (any API with publicPackages). Per-npm-package layout
// (which subtree of the tarball holds the .d.ts files, and whether to chase
// transitive deps) lives in PACKAGE_EXTRACTION_RECIPES above. The four shapes
// that result (mirroring loadTypesIntoTSEnv):
//   - @shopify/ui-extensions: package.json + build/ts/*.d.ts + build/ts/surfaces/<surface>/**/*.d.ts + build/ts/surfaces/<surface>.d.ts
//   - @shopify/ui-extensions-react: same surface layout as @shopify/ui-extensions (pinned version) + its 6 transitive @remote-ui/* / @types/react-reconciler deps
//   - @shopify/polaris-types, @shopify/app-bridge-types: package.json + dist/**/*.d.ts
//   - @shopify/hydrogen: package.json + dist/**/*.d.ts + its 6 transitive deps

const npmCache = {
  distTags: new Map(),
  versions: new Map(),
  tarballs: new Map(),
};

const tmpDirsToCleanup = new Set();

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function fetchNpmDistTags(pkg) {
  if (npmCache.distTags.has(pkg)) return npmCache.distTags.get(pkg);
  if (process.env.UPDATE_APIS_FAKE_NPM_DIR) {
    const tagsPath = path.join(
      process.env.UPDATE_APIS_FAKE_NPM_DIR,
      pkg,
      "dist-tags.json",
    );
    if (!existsSync(tagsPath)) {
      throw new Error(
        `FAKE_NPM: missing dist-tags.json for ${pkg} at ${tagsPath}`,
      );
    }
    const tags = JSON.parse(readFileSync(tagsPath, "utf-8"));
    npmCache.distTags.set(pkg, tags);
    return tags;
  }
  const url = `${NPM_REGISTRY}/-/package/${encodeURIComponent(pkg)}/dist-tags`;
  const tags = await fetchJson(url);
  npmCache.distTags.set(pkg, tags);
  return tags;
}

async function fetchNpmVersionsList(pkg) {
  if (npmCache.versions.has(pkg)) return npmCache.versions.get(pkg);
  if (process.env.UPDATE_APIS_FAKE_NPM_DIR) {
    // Fake mode: infer published versions from the directory names present.
    const pkgRoot = path.join(process.env.UPDATE_APIS_FAKE_NPM_DIR, pkg);
    const versions = existsSync(pkgRoot)
      ? readdirSync(pkgRoot, { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => e.name)
      : [];
    npmCache.versions.set(pkg, versions);
    return versions;
  }
  const url = `${NPM_REGISTRY}/${encodeURIComponent(pkg)}`;
  const meta = await fetchJson(url);
  const versions = Object.keys(meta.versions ?? {});
  npmCache.versions.set(pkg, versions);
  return versions;
}

/**
 * Resolve a concrete npm semver for (pkg, apiVersion).
 *
 * Strategy: try the dist-tag named `<apiVersion>` first. If `isRc` and that
 * miss, try the generic `rc` dist-tag — some packages (e.g.
 * `@shopify/ui-extensions`) publish the upcoming release candidate under tag
 * `rc` rather than the API-version name, so `2026-07` won't have its own tag
 * but `rc` points at `2026.7.0-rc.5`. If everything misses and `fallback` is
 * set, fall back to the highest published stable `<year>.<month>.x`. Returns
 * `null` if nothing matches.
 */
async function resolveNpmVersionForApi(
  pkg,
  apiVersion,
  { fallback = false, isRc = false } = {},
) {
  const tags = await fetchNpmDistTags(pkg);
  if (tags[apiVersion]) return tags[apiVersion];
  if (isRc && tags.rc) return tags.rc;

  if (!fallback) return null;

  const m = /^(\d{4})-(\d{2})$/.exec(apiVersion);
  if (!m) return null;
  const [, year, month] = m;
  const prefix = `${year}.${Number(month)}.`;

  const versions = await fetchNpmVersionsList(pkg);
  // Exclude prereleases. semverCompare ranks "2026.4.2-rc.1" *after* "2026.4.2"
  // (its trailing "rc" sorts lexically above the missing-segment default), so
  // an RC tarball would otherwise win the fallback for a stable apiVersion.
  const matches = versions
    .filter((v) => v.startsWith(prefix) && !v.includes("-"))
    .sort((a, b) => semverCompare(a, b));
  if (matches.length === 0) return null;
  return matches[matches.length - 1];
}

/**
 * Resolve a semver range expression (e.g. "^7.10.0", ">=2.0", "~16.13") to a
 * concrete published version. Picks the highest published version that
 * satisfies the range. Simplistic — handles ^, ~, exact, and plain ranges; for
 * complex ranges (logical OR, hyphen, etc.) it falls back to the dist-tag
 * `latest`.
 */
async function resolveSemverRange(pkg, range) {
  const versions = await fetchNpmVersionsList(pkg);

  // Strip any prefix and try direct match first
  const cleaned = range.replace(/^[\s=v]+/, "").trim();
  if (versions.includes(cleaned)) return cleaned;

  const compatible = compatibleVersions(versions, cleaned);
  if (compatible.length > 0) {
    return compatible[compatible.length - 1];
  }

  // Fall back to latest. Warn loudly: this path swaps in whatever the publisher
  // currently calls "latest", which may be on a newer major the parent package
  // was never tested against (e.g. type-fest at ">=5" landing on v6's API).
  // Until we adopt the `semver` package and handle ranges properly, this is the
  // only signal that the extracted types may not match what the parent expects.
  const tags = await fetchNpmDistTags(pkg);
  if (tags.latest) {
    warn(
      `${pkg}: unsupported range "${range}", falling back to dist-tag latest=${tags.latest}`,
    );
  }
  return tags.latest ?? null;
}

function compatibleVersions(versions, range) {
  // Drop pre-release versions for stability
  const stable = versions.filter((v) => !v.includes("-"));
  // ^X.Y.Z → same major
  let m = /^\^(\d+)\.(\d+)\.(\d+)/.exec(range);
  if (m) {
    const major = m[1];
    return stable
      .filter((v) => v.split(".")[0] === major)
      .sort((a, b) => semverCompare(a, b));
  }
  // ~X.Y.Z → same major.minor
  m = /^~(\d+)\.(\d+)\.(\d+)/.exec(range);
  if (m) {
    const prefix = `${m[1]}.${m[2]}.`;
    return stable
      .filter((v) => v.startsWith(prefix))
      .sort((a, b) => semverCompare(a, b));
  }
  // Plain X.Y.Z → exact
  m = /^(\d+\.\d+\.\d+)$/.exec(range);
  if (m) {
    return stable.includes(m[1]) ? [m[1]] : [];
  }
  // X.Y → highest patch in that minor
  m = /^(\d+)\.(\d+)$/.exec(range);
  if (m) {
    const prefix = `${m[1]}.${m[2]}.`;
    return stable
      .filter((v) => v.startsWith(prefix))
      .sort((a, b) => semverCompare(a, b));
  }
  // *, latest, anything weird — let caller fall back
  return [];
}

/**
 * Download and unpack <pkg>@<version> into a tmp dir.
 *
 * Returns the absolute path to the extracted `package/` directory. Cached per
 * (pkg, version) within a single script run. The UPDATE_APIS_FAKE_NPM_DIR
 * env var skips the network for tests: the helper looks for
 * `${UPDATE_APIS_FAKE_NPM_DIR}/<pkg>/<version>/` and treats it as the
 * already-extracted package root.
 */
async function extractTarball(pkg, version) {
  const cacheKey = `${pkg}@${version}`;
  if (npmCache.tarballs.has(cacheKey)) return npmCache.tarballs.get(cacheKey);

  if (process.env.UPDATE_APIS_FAKE_NPM_DIR) {
    const fakePath = path.join(
      process.env.UPDATE_APIS_FAKE_NPM_DIR,
      pkg,
      version,
    );
    if (!existsSync(fakePath)) {
      throw new Error(
        `FAKE_NPM: expected ${cacheKey} at ${fakePath} but directory is missing`,
      );
    }
    npmCache.tarballs.set(cacheKey, fakePath);
    return fakePath;
  }

  const meta = await fetchJson(
    `${NPM_REGISTRY}/${encodeURIComponent(pkg)}/${encodeURIComponent(version)}`,
  );
  const tarballUrl = meta?.dist?.tarball;
  if (!tarballUrl) {
    throw new Error(`No dist.tarball in registry metadata for ${cacheKey}`);
  }

  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const os = await import("node:os");
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "update-apis-tarball-"));
  tmpDirsToCleanup.add(tmpDir);

  const tarballPath = path.join(tmpDir, "pkg.tgz");
  const res = await fetch(tarballUrl);
  if (!res.ok) {
    throw new Error(
      `Failed to download ${tarballUrl}: ${res.status} ${res.statusText}`,
    );
  }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(tarballPath, buf);

  execSync(`tar -xzf "${tarballPath}" -C "${tmpDir}"`, { stdio: "pipe" });

  // Most npm tarballs use `package/` as their top-level directory, but the
  // DefinitelyTyped publisher strips the `@types/` scope and uses just the
  // bare name (e.g. `@types/react` extracts to `react/`). Find whichever
  // subdirectory actually exists — there should be exactly one alongside the
  // tarball file.
  const entries = readdirSync(tmpDir, { withFileTypes: true }).filter((e) =>
    e.isDirectory(),
  );
  if (entries.length !== 1) {
    throw new Error(
      `tar extracted ${entries.length} directories in ${tmpDir}, expected 1`,
    );
  }
  const packageRoot = path.join(tmpDir, entries[0].name);
  npmCache.tarballs.set(cacheKey, packageRoot);
  return packageRoot;
}

function cleanupTarballTmpDirs() {
  for (const dir of tmpDirsToCleanup) {
    try {
      execSync(`rm -rf "${dir}"`, { stdio: "pipe" });
    } catch {
      // best-effort
    }
  }
  tmpDirsToCleanup.clear();
}

/**
 * Walk dir for type-source files. Includes `.d.ts` files (declaration bundles)
 * and `.ts` files (some packages, e.g. @shopify/app-bridge-types, ship a
 * companion `.ts` source alongside the bundled `.d.ts` and import it via
 * relative module specifiers — TS module resolution picks up `.ts` files).
 * Excludes test/spec files. Skips node_modules.
 */
function findDtsFiles(dir, results = []) {
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findDtsFiles(fullPath, results);
    } else if (entry.isFile()) {
      const name = entry.name;
      const isTypeFile =
        name.endsWith(".d.ts") ||
        (name.endsWith(".ts") &&
          !name.endsWith(".test.ts") &&
          !name.endsWith(".spec.ts"));
      if (isTypeFile) results.push(fullPath);
    }
  }
  return results;
}

/**
 * Copy package.json + the subset of files under `includeRelPaths` into
 * destRoot, preserving relative paths. Each include entry is either a
 * directory (walked recursively for .d.ts/.ts files) or a single file path
 * (copied as-is — used for entry-point .d.ts siblings referenced by
 * `typesVersions` / `exports.types`).
 * Returns the count of files copied.
 */
async function copyExtractedFiles(packageRoot, destRoot, includeRelPaths) {
  const { mkdirSync, statSync } = await import("node:fs");
  mkdirSync(destRoot, { recursive: true });

  let count = 0;

  // package.json — always copy
  const pkgJsonSrc = path.join(packageRoot, "package.json");
  if (existsSync(pkgJsonSrc)) {
    const pkgJsonDest = path.join(destRoot, "package.json");
    copyFileSync(pkgJsonSrc, pkgJsonDest);
    clearStaleGz(pkgJsonDest);
    count++;
  }

  // .d.ts trees (or single files) under each include path
  for (const rel of includeRelPaths) {
    const src = path.join(packageRoot, rel);
    if (!existsSync(src)) continue;
    const isDir = statSync(src).isDirectory();
    const srcFiles = isDir ? findDtsFiles(src) : [src];
    for (const srcFile of srcFiles) {
      const relPath = path.relative(packageRoot, srcFile);
      const destFile = path.join(destRoot, relPath);
      mkdirSync(path.dirname(destFile), { recursive: true });
      copyFileSync(srcFile, destFile);
      clearStaleGz(destFile);
      count++;
    }
  }

  return count;
}

/**
 * Same as copyExtractedFiles but copies ALL .d.ts files under packageRoot
 * (excluding node_modules and dotfiles). Used for transitive deps that have
 * type files scattered outside a single `dist/` directory (e.g. type-fest,
 * schema-dts).
 */
async function copyAllDtsAndPackageJson(packageRoot, destRoot) {
  const { mkdirSync } = await import("node:fs");
  mkdirSync(destRoot, { recursive: true });
  let count = 0;
  const pkgJsonSrc = path.join(packageRoot, "package.json");
  if (existsSync(pkgJsonSrc)) {
    const pkgJsonDest = path.join(destRoot, "package.json");
    copyFileSync(pkgJsonSrc, pkgJsonDest);
    clearStaleGz(pkgJsonDest);
    count++;
  }
  for (const srcFile of findDtsFiles(packageRoot)) {
    const relPath = path.relative(packageRoot, srcFile);
    const destFile = path.join(destRoot, relPath);
    mkdirSync(path.dirname(destFile), { recursive: true });
    copyFileSync(srcFile, destFile);
    clearStaleGz(destFile);
    count++;
  }
  return count;
}

// Drop the matching .gz sibling so compress-json regenerates it on the next
// pass. compress-json's `if (.gz exists) skip` would otherwise leave stale
// compressed copies of overwritten source files.
function clearStaleGz(destFile) {
  const gzPath = `${destFile}.gz`;
  if (existsSync(gzPath)) unlinkSync(gzPath);
}

/**
 * Build the full extraction plan: for each API name × API version, the list of
 * (pkg, version, includeRelPaths) tuples to extract. Returns:
 *   {
 *     plan: [{ apiName, apiVersion, packages: [{ pkg, version, includeRelPaths, copyMode }] }],
 *     index: { apiName: { apiVersion: [{ package, version }] }, _always_loaded: [...] },
 *     extractions: Map<`${pkg}@${version}`, { pkg, version, includeRelPaths, copyMode }>
 *   }
 *
 * Iteration is driven by SHOPIFY_APIS (any entry with a publicPackages list).
 * Per-package layout — what subtree holds the .d.ts files, transitive deps —
 * comes from PACKAGE_EXTRACTION_RECIPES.
 */
async function buildTypeExtractionPlan(opts, supportedVersions, apis) {
  const plan = [];
  const index = { _always_loaded: [] };
  const extractions = new Map();

  const addExtraction = (pkg, version, includeRelPaths, copyMode) => {
    const key = `${pkg}@${version}`;
    const existing = extractions.get(key);
    if (existing) {
      // Merge include paths — same package, same version, broader surface
      for (const p of includeRelPaths) {
        if (!existing.includeRelPaths.includes(p)) {
          existing.includeRelPaths.push(p);
        }
      }
      return existing;
    }
    const entry = {
      pkg,
      version,
      includeRelPaths: [...includeRelPaths],
      copyMode,
    };
    extractions.set(key, entry);
    return entry;
  };

  // For a single (pkg, version), add the extraction for pkg itself plus any
  // transitive deps the recipe asks for. Returns the full list of {pkg, version}
  // tuples that ended up in the index for this slot. `overrideIncludes` lets
  // the surface-based call site pass in surface-specific subpaths instead of
  // the recipe's default `includeSubpaths` (which doesn't exist for
  // surface-layout packages).
  const expandPackageExtraction = async (pkg, version, overrideIncludes) => {
    const recipe = PACKAGE_EXTRACTION_RECIPES[pkg];
    const includes = [...(overrideIncludes ?? recipe?.includeSubpaths ?? [])];

    // Extract once for both branches below. extractTarball is cached per
    // (pkg, version), so the second call would be a no-op anyway, but reading
    // a single hoisted `root` is clearer than two `await extractTarball(...)`
    // calls scattered through the function.
    const needsTarball =
      recipe?.shallowSubpaths?.length || recipe?.transitiveDeps?.length;
    const root = needsTarball ? await extractTarball(pkg, version) : null;

    // Expand `shallowSubpaths` to concrete file paths now (rather than a new
    // include format) so the rest of the pipeline keeps treating
    // `includeRelPaths` as a flat list of strings. Each entry is a directory
    // whose direct `.d.ts` children are included, but subdirectories are not
    // walked — keeps the surface boundaries intact while picking up sibling
    // entry-point files like `build/ts/extension.d.ts`.
    if (recipe?.shallowSubpaths?.length) {
      for (const shallowDir of recipe.shallowSubpaths) {
        const fullDir = path.join(root, shallowDir);
        if (!existsSync(fullDir)) continue;
        for (const entry of readdirSync(fullDir, { withFileTypes: true })) {
          if (entry.isFile() && entry.name.endsWith(".d.ts")) {
            includes.push(path.join(shallowDir, entry.name));
          }
        }
      }
    }

    addExtraction(pkg, version, includes, "include");
    const expanded = [{ pkg, version }];

    if (recipe?.transitiveDeps?.length) {
      const pkgJson = JSON.parse(
        readFileSync(path.join(root, "package.json"), "utf-8"),
      );
      const declared = {
        ...(pkgJson.dependencies ?? {}),
        ...(pkgJson.peerDependencies ?? {}),
      };
      for (const dep of recipe.transitiveDeps) {
        const depPkg = typeof dep === "string" ? dep : dep.name;
        // Resolution precedence: explicit `pinnedVersion` on the recipe →
        // the parent's declared range (via resolveSemverRange) → `latest`.
        // Pins exist for deps that aren't in the parent's package.json: we
        // can't read a deeper package.json's range without recursing, so the
        // recipe encodes the compatible version directly.
        const pinned = typeof dep === "object" ? dep.pinnedVersion : null;
        let depVersion;
        if (pinned) {
          depVersion = pinned;
        } else {
          const range = declared[depPkg];
          depVersion = range
            ? await resolveSemverRange(depPkg, range)
            : (await fetchNpmDistTags(depPkg)).latest;
        }
        if (!depVersion) {
          warn(`${pkg}@${version}: could not resolve ${depPkg}`);
          continue;
        }
        addExtraction(depPkg, depVersion, [], "all-dts");
        expanded.push({ pkg: depPkg, version: depVersion });
      }
    }
    return expanded;
  };

  const recordSlot = (apiName, apiVersion, packages) => {
    plan.push({ apiName, apiVersion, packages });
    index[apiName] = index[apiName] ?? {};
    index[apiName][apiVersion] = packages.map(({ pkg, version }) => ({
      package: pkg,
      version,
    }));
  };

  for (const api of Object.values(apis)) {
    if (!api.publicPackages?.length) continue;
    const apiName = api.name;

    // Surface-based packages (anything with a `surfaceSubpath` recipe) share a
    // single npm tarball across APIs; the surface determines which subtree we
    // want. APIs lacking extensionSurfaceName aren't valid consumers — skip
    // with a warning rather than copy the wrong surface.
    const surfacePackageNames = api.publicPackages
      .map(getPublicPackageName)
      .filter((name) => PACKAGE_EXTRACTION_RECIPES[name]?.surfaceSubpath);
    if (surfacePackageNames.length > 0 && !api.extensionSurfaceName) {
      warn(
        `${apiName}: declares ${surfacePackageNames.join(", ")} but no extensionSurfaceName, skipping`,
      );
      continue;
    }

    if (api.versioned) {
      const versions = supportedVersions[apiName] ?? [];
      if (versions.length === 0) {
        warn(`No supported versions listed for ${apiName}, skipping`);
        continue;
      }
      const apiVersionEntries = opts.version
        ? versions.filter((v) => v.name === opts.version)
        : versions;

      for (const versionEntry of apiVersionEntries) {
        const apiVersion = versionEntry.name;
        const isRc = !!versionEntry.releaseCandidate;
        const slotPackages = [];
        for (const entry of api.publicPackages) {
          // Tagged entries with a `versions` constraint are excluded from
          // unrelated version slots. This is what keeps the React bindings
          // (valid only for 2025-07) out of every web-component-era version
          // of admin/checkout/customer-account/pos-ui.
          if (!publicPackageAppliesToVersion(entry, apiVersion)) continue;
          const pkg = getPublicPackageName(entry);
          const recipe = PACKAGE_EXTRACTION_RECIPES[pkg];

          // Surface-based packages share a tarball across APIs; the API's
          // extensionSurfaceName picks which subtree to include. Resolves to
          // a pinned version if the recipe sets one, otherwise via dist-tag.
          // Routed through expandPackageExtraction so surface packages can
          // also declare transitiveDeps (e.g. @shopify/ui-extensions-react's
          // @remote-ui/* chain).
          if (recipe?.surfaceSubpath) {
            const npmVersion =
              recipe.pinnedVersion ??
              (await resolveNpmVersionForApi(pkg, apiVersion, { isRc }));
            if (!npmVersion) {
              warn(
                `${apiName}@${apiVersion}: no ${pkg} version found (no matching dist-tag)`,
              );
              continue;
            }
            const expanded = await expandPackageExtraction(
              pkg,
              npmVersion,
              recipe.surfaceSubpath(api.extensionSurfaceName),
            );
            slotPackages.push(...expanded);
            continue;
          }

          // Hydrogen and any future per-version package: resolve, extract,
          // and chase transitive deps if its recipe asks for them.
          const npmVersion = await resolveNpmVersionForApi(pkg, apiVersion, {
            fallback: true,
            isRc,
          });
          if (!npmVersion) {
            warn(`${apiName}@${apiVersion}: no ${pkg} version resolved`);
            continue;
          }
          const expanded = await expandPackageExtraction(pkg, npmVersion);
          slotPackages.push(...expanded);
        }
        if (slotPackages.length > 0)
          recordSlot(apiName, apiVersion, slotPackages);
      }
    } else {
      // Unversioned API — extract each publicPackage at `latest`, key under "_".
      // `versions` constraints on tagged entries are ignored here (apiVersion
      // is undefined for unversioned APIs).
      const slotPackages = [];
      for (const entry of api.publicPackages) {
        const pkg = getPublicPackageName(entry);
        const tags = await fetchNpmDistTags(pkg);
        if (!tags.latest) {
          warn(`${pkg}: no 'latest' dist-tag, skipping`);
          continue;
        }
        const expanded = await expandPackageExtraction(pkg, tags.latest);
        slotPackages.push(...expanded);
      }
      if (slotPackages.length > 0) recordSlot(apiName, "_", slotPackages);
    }
  }

  // Always-loaded type packages: pinned version if the recipe entry tags one,
  // otherwise `latest`. Recorded under _always_loaded.
  for (const entry of ALWAYS_LOADED_TYPE_PACKAGES) {
    const pkg = typeof entry === "string" ? entry : entry.name;
    const pinned = typeof entry === "object" ? entry.pinnedVersion : null;
    let version;
    if (pinned) {
      version = pinned;
    } else {
      const tags = await fetchNpmDistTags(pkg);
      if (!tags.latest) {
        warn(`${pkg}: no 'latest' dist-tag, skipping always-loaded extraction`);
        continue;
      }
      version = tags.latest;
    }
    addExtraction(pkg, version, [], "all-dts");
    index._always_loaded.push({ package: pkg, version });
  }

  return { plan, index, extractions };
}

function summarizeTypePlan(plan) {
  const byApi = new Map();
  for (const item of plan) {
    if (!byApi.has(item.apiName)) byApi.set(item.apiName, []);
    const pkgSummary = item.packages
      .map((p) => `${p.pkg}@${p.version}`)
      .join(", ");
    byApi.get(item.apiName).push(`${item.apiVersion} → ${pkgSummary}`);
  }
  return byApi;
}

function findStaleTypeDirs(typesDir, expectedPackageVersions) {
  if (!existsSync(typesDir)) return [];

  const stale = [];
  const expected = new Set();
  for (const { pkg, version } of expectedPackageVersions) {
    expected.add(`${pkg}@${version}`);
  }

  // Walk types/ — top level can be a plain package dir (e.g. preact/) or a
  // scope dir (@shopify/). One level deeper is the package; the level after
  // that is the version.
  for (const top of readdirSync(typesDir, { withFileTypes: true })) {
    if (!top.isDirectory()) continue;
    const topPath = path.join(typesDir, top.name);
    if (top.name.startsWith("@")) {
      for (const pkg of readdirSync(topPath, { withFileTypes: true })) {
        if (!pkg.isDirectory()) continue;
        const pkgPath = path.join(topPath, pkg.name);
        const pkgName = `${top.name}/${pkg.name}`;
        for (const ver of readdirSync(pkgPath, { withFileTypes: true })) {
          if (!ver.isDirectory()) continue;
          if (!expected.has(`${pkgName}@${ver.name}`)) {
            stale.push(path.join(pkgPath, ver.name));
          }
        }
      }
    } else {
      const pkgName = top.name;
      for (const ver of readdirSync(topPath, { withFileTypes: true })) {
        if (!ver.isDirectory()) continue;
        if (!expected.has(`${pkgName}@${ver.name}`)) {
          stale.push(path.join(topPath, ver.name));
        }
      }
    }
  }

  return stale;
}

async function updateTypeAssets(opts, apis) {
  heading("Part 3: UI Type Asset Extraction");

  let supportedVersions;
  try {
    supportedVersions = readSupportedVersions();
  } catch (e) {
    error(e.message);
    return false;
  }

  log("Building extraction plan (resolving npm versions)...");
  let plan, index, extractions;
  try {
    ({ plan, index, extractions } = await buildTypeExtractionPlan(
      opts,
      supportedVersions,
      apis,
    ));
  } catch (e) {
    error(`Failed to build plan: ${e.message}`);
    cleanupTarballTmpDirs();
    return false;
  }

  if (plan.length === 0 && index._always_loaded.length === 0) {
    log("  Nothing to extract");
    return true;
  }

  heading("Type extraction plan");
  for (const [apiName, lines] of summarizeTypePlan(plan)) {
    log(`  ${apiName}:`);
    for (const line of lines) log(`    ${line}`);
  }
  if (index._always_loaded.length > 0) {
    log("  _always_loaded:");
    for (const { package: pkg, version } of index._always_loaded) {
      log(`    ${pkg}@${version}`);
    }
  }
  log(`  Unique (pkg, version) extractions: ${extractions.size}`);

  if (!opts.yes) {
    const ok = await confirm(`Extract ${extractions.size} package versions?`);
    if (!ok) {
      warn("Aborted");
      cleanupTarballTmpDirs();
      return false;
    }
  }

  const typesDir = path.join(DATA_DIR, TYPES_DIR_NAME);

  heading("Extracting type assets");
  let totalFiles = 0;
  try {
    // extractions is deduped by (pkg, version), so concurrent calls won't race
    // for the same tarball cache key. Each fetch + tar -xzf is independent.
    const counts = await Promise.all(
      [...extractions.values()].map(
        async ({ pkg, version, includeRelPaths, copyMode }) => {
          const packageRoot = await extractTarball(pkg, version);
          const destRoot = path.join(typesDir, pkg, version);
          const count =
            copyMode === "all-dts"
              ? await copyAllDtsAndPackageJson(packageRoot, destRoot)
              : await copyExtractedFiles(
                  packageRoot,
                  destRoot,
                  includeRelPaths,
                );
          success(`  ${pkg}@${version}: ${count} files`);
          return count;
        },
      ),
    );
    totalFiles = counts.reduce((sum, n) => sum + n, 0);
  } catch (e) {
    error(`Extraction failed: ${e.message}`);
    cleanupTarballTmpDirs();
    return false;
  }

  // Write the index last — only after every extraction succeeded.
  const indexPath = path.join(typesDir, TYPES_INDEX_FILENAME);
  writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");
  success(`  Wrote ${TYPES_INDEX_FILENAME}`);
  log(
    `  ${totalFiles} files copied across ${extractions.size} package versions`,
  );

  // Stale cleanup: only in catalog mode (no --version override).
  if (!opts.version) {
    heading("Cleaning up stale type assets");
    const expected = [];
    for (const entry of extractions.values()) {
      expected.push({ pkg: entry.pkg, version: entry.version });
    }
    const stale = findStaleTypeDirs(typesDir, expected);
    if (stale.length === 0) {
      log("  No stale type assets found");
    } else {
      for (const dir of stale) {
        execSync(`rm -rf "${dir}"`, { stdio: "pipe" });
        success(`  Deleted ${path.relative(typesDir, dir)}`);
      }
    }
  }

  cleanupTarballTmpDirs();

  // Compress so dist/ ships only .gz siblings (loadTypesIntoTSEnv gunzips
  // into memory at read time, matching the schemas pattern).
  heading("Compressing type assets");
  try {
    execSync("pnpm run compress-json", {
      cwd: PACKAGE_ROOT,
      stdio: "inherit",
    });
  } catch (e) {
    error(`Compression failed: ${e.message}`);
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function loadApiMapping(opts) {
  if (process.env.UPDATE_APIS_API_MAPPING_MODULE) {
    return import(
      pathToFileURL(process.env.UPDATE_APIS_API_MAPPING_MODULE).href
    );
  }

  const mappingKind = opts.internal ? "internal" : "types";
  const builtMapping = path.join(
    PACKAGE_ROOT,
    "dist",
    mappingKind,
    "api-mapping.js",
  );
  if (existsSync(builtMapping)) {
    return import(pathToFileURL(builtMapping).href);
  }

  // A clean checkout has no ignored dist/ output. Register the package's
  // development TypeScript loader so this maintenance command and its tests
  // work before the first build.
  const sourceMapping = path.join(
    PACKAGE_ROOT,
    "src",
    mappingKind,
    "api-mapping.ts",
  );
  const { register } = await import("tsx/esm/api");
  const unregister = register();
  try {
    return await import(pathToFileURL(sourceMapping).href);
  } finally {
    unregister();
  }
}

async function main() {
  heading("shopify-dev-tools API Update Script");

  const opts = parseArgs();

  // UPDATE_APIS_API_MAPPING_MODULE (absolute path) lets tests inject a custom
  // SHOPIFY_APIS — e.g. to exercise the surface-package precheck that warns
  // and skips APIs declaring a surfacePackage without an extensionSurfaceName.
  const { SHOPIFY_APIS, getShopifyDevSchemaMap } = await loadApiMapping(opts);
  const schemaMap = getShopifyDevSchemaMap();

  if (opts.internal) {
    log("  Internal mode: including internal APIs");
  }

  let versionsOk = true;
  let schemaOk = true;
  let liquidOk = true;
  let typesOk = true;

  const runSchemas = !opts.versionsOnly && !opts.typesOnly;
  const runLiquid = !opts.schemasOnly && !opts.versionsOnly && !opts.typesOnly;
  const runTypes = !opts.schemasOnly && !opts.versionsOnly;

  if (!opts.skipVersions && (!opts.schemasOnly || opts.versionsOnly)) {
    versionsOk = await writeSupportedVersions();
  }

  if (runSchemas) {
    schemaOk = await updateSchemas(opts, schemaMap);
  }

  if (runLiquid) {
    liquidOk = await updateLiquidPackages(opts);
  }

  if (runTypes) {
    typesOk = await updateTypeAssets(opts, SHOPIFY_APIS);
  }

  // Summary
  heading("Summary");
  if (!opts.typesOnly) {
    log(`  Supported versions: ${versionsOk ? "✓" : "✗"}`);
  }
  if (runSchemas) {
    log(`  GraphQL schemas:    ${schemaOk ? "✓" : "✗"}`);
  }
  if (runLiquid) {
    log(`  Liquid (theme-check): ${liquidOk ? "✓" : "✗"}`);
  }
  if (runTypes) {
    log(`  UI type assets:     ${typesOk ? "✓" : "✗"}`);
  }

  if (!versionsOk || !schemaOk || !liquidOk || !typesOk) {
    log("\nSome steps had issues. Review the output above.");
    process.exit(1);
  }

  log("\nDone! Next steps:");
  log("  1. Review the changes: git diff");
  log("  2. Run tests: pnpm run test");
  log("  3. Run typecheck: pnpm run typecheck");
}

main().catch((e) => {
  error(e.message);
  process.exit(1);
});

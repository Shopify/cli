/**
 * Generates agent skill directories into packages/skills/ (gitignored output).
 *
 * Consumers of the generated tree:
 *   - Mirror workflow → pushes to Shopify/Shopify-AI-Toolkit on Version PR merge.
 *   - Evals → shells out to validate.mjs / search_docs.mjs at eval time.
 *
 * Not published to npm. The source of truth is src/instructions/*.md in this
 * package; packages/skills/ is generated on demand and must never be committed.
 *
 * SKILL_VERSION is sourced from this package's package.json version — bumping
 * @shopify/shopify-dev-tools is the signal for mirror content to move forward.
 *
 * For each public API in SHOPIFY_APIS:
 *   - Creates packages/skills/{skill-name}/SKILL.md  (raw MD + mandatory blocks)
 *   - Bundles scripts/search_docs.mjs   (esbuild, self-contained)
 *   - Bundles scripts/validate.mjs      (esbuild, self-contained, chosen by APICategory)
 *   - Copies schema assets to assets/  (GraphQL/Functions APIs)
 *
 * Also creates the generic packages/skills/shopify-dev/ (no api_name filter, no validate).
 *
 * Run: pnpx tsx scripts/generate-agent-skills.ts
 */

import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import * as esbuild from "esbuild";

import {
  buildSkillMd,
  rewriteSkillReferences,
  skillFrontmatter,
  mandatorySearchOnlyBlock,
  searchPrivacyBlock,
  skillUsePrivacyBlock,
} from "../src/instructions/skill-blocks.js";
import {
  getPublishedSkillName,
  SHOPIFY_APIS,
} from "../src/types/api-mapping.js";
import { APICategory, Visibility } from "../src/types/api-types.js";
import { getSupportedVersions } from "../src/types/api-versions.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..");
const MONOREPO_ROOT = join(PACKAGE_ROOT, "..", "..");

const DEFAULT_RAW_INSTRUCTIONS_DIR = join(PACKAGE_ROOT, "src/instructions");
const SCHEMA_DATA_DIR = join(PACKAGE_ROOT, "src/data");
const SCRIPTS_SRC_DIR = join(PACKAGE_ROOT, "src/agent-skills/scripts");
const SKILL_ASSETS_DIR = join(PACKAGE_ROOT, "src/skill-assets");
const DEFAULT_AGENT_SKILLS_OUT_DIR = join(MONOREPO_ROOT, "packages", "skills");
const SKILL_TELEMETRY_HOOKS_DIR = join(
  PACKAGE_ROOT,
  "src",
  "agent-skills",
  "hooks",
);

// Files copied verbatim into each generated skill's `scripts/` directory so
// the skill-frontmatter `hooks:` block (Claude Code only — see
// `skillTelemetryHookBlock` in src/instructions/skill-blocks.ts) can resolve
// `./scripts/track-telemetry.sh` on standalone installs.
const SKILL_TELEMETRY_HOOK_FILES = [
  "track-telemetry.sh",
  "track-telemetry.ps1",
] as const;

function copySkillTelemetryHook(scriptsDir: string): void {
  for (const file of SKILL_TELEMETRY_HOOK_FILES) {
    const src = join(SKILL_TELEMETRY_HOOKS_DIR, file);
    if (!existsSync(src)) {
      throw new Error(
        `Expected ${src} to exist. The skill-frontmatter telemetry hook is bundled into each generated skill from shopify-dev-tools.`,
      );
    }
    const dest = join(scriptsDir, file);
    copyFileSync(src, dest);
    if (file.endsWith(".sh")) {
      chmodSync(dest, 0o755);
    }
  }
}

const GENERIC_SKILL_NAME = "shopify-dev";

// ─── Version helpers ──────────────────────────────────────────────────────────

function installedVersion(pkg: string): string {
  const pkgJsonPath = join(PACKAGE_ROOT, "node_modules", pkg, "package.json");
  const content = JSON.parse(readFileSync(pkgJsonPath, "utf-8")) as {
    version: string;
  };
  return content.version;
}

const SKILL_VERSION = (
  JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf-8")) as {
    version: string;
  }
).version;

// ─── Script bundling ──────────────────────────────────────────────────────────

interface BundleOptions {
  entryPoint: string;
  outFile: string;
  defines?: Record<string, string>;
  external?: string[];
}

async function bundleScript(opts: BundleOptions): Promise<void> {
  await esbuild.build({
    entryPoints: [opts.entryPoint],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: opts.outFile,
    target: "node20",
    define: opts.defines ?? {},
    external: opts.external ?? [],
    banner: {
      js: `#!/usr/bin/env node`,
    },
    logLevel: "warning",
  });
  chmodSync(opts.outFile, 0o755);
}

// ─── Asset helpers ────────────────────────────────────────────────────────────

function findSchemaFiles(apiNamePrefix: string): string[] {
  const all = readdirSync(SCHEMA_DATA_DIR).filter(
    (f) =>
      f.startsWith(apiNamePrefix) &&
      (f.endsWith(".json.gz") || f.endsWith(".json")),
  );
  // Prefer .json.gz over uncompressed .json for the same base name
  const gzFiles = all.filter((f) => f.endsWith(".json.gz"));
  const jsonFiles = all.filter(
    (f) => f.endsWith(".json") && !f.endsWith(".json.gz"),
  );
  const coveredByGz = new Set(gzFiles.map((f) => f.slice(0, -3))); // strip ".gz"
  return [...gzFiles, ...jsonFiles.filter((f) => !coveredByGz.has(f))];
}

function copyAssets(skillDir: string, schemaFiles: string[]): void {
  const assetsDir = join(skillDir, "assets");
  mkdirSync(assetsDir, { recursive: true });
  for (const file of schemaFiles) {
    copyFileSync(join(SCHEMA_DATA_DIR, file), join(assetsDir, file));
    console.log(`  copied asset: ${file}`);
  }
}

function copyGraphQLDataAssets(skillDir: string, schemaFiles: string[]): void {
  const dataDir = join(skillDir, "data");
  mkdirSync(dataDir, { recursive: true });
  copyFileSync(
    join(SCHEMA_DATA_DIR, "supported-versions-schema.json"),
    join(dataDir, "supported-versions-schema.json"),
  );
  console.log("  copied data asset: supported-versions-schema.json");
  for (const file of schemaFiles) {
    copyFileSync(join(SCHEMA_DATA_DIR, file), join(dataDir, file));
    console.log(`  copied data asset: ${file}`);
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

const TYPES_DATA_DIR = join(SCHEMA_DATA_DIR, "types");
const SUPPORTED_VERSIONS_SOURCE = join(
  SCHEMA_DATA_DIR,
  "supported-versions-schema.json",
);

let cachedTypesIndex: TypesIndex | undefined;
function readTypesIndex(): TypesIndex {
  if (cachedTypesIndex) return cachedTypesIndex;
  const indexPath = join(TYPES_DATA_DIR, "index.json");
  cachedTypesIndex = JSON.parse(readFileSync(indexPath, "utf-8")) as TypesIndex;
  return cachedTypesIndex;
}

/**
 * Ship the bundled UI type assets that this skill's validate.mjs needs at
 * runtime. The loader (`loadTypesIntoTSEnv`) auto-detects this layout via the
 * sibling `<skill>/scripts/` check, so no script-time configuration is needed.
 *
 * Layout written:
 *   <skill>/assets/types/<pkg>/<version>/...    one subtree per (pkg, version)
 *   <skill>/assets/types/index.json             filtered to this apiKey + _always_loaded
 *   <skill>/assets/supported-versions-schema.json
 *
 * The (pkg, version) set is the union of every entry the apiKey references in
 * the source `index.json` (across all supported apiVersions, including the
 * unversioned `_` key) plus `_always_loaded`. That way `--version 2025-07`
 * resolves to the right subtree without re-shipping a per-version slice.
 *
 * Throws when a UI_FRAMEWORK API with publicPackages has no index entry (or
 * has the legacy PackageRef[] shape). UI frameworks that legitimately ship
 * without an npm package (storefront web components — CDN script) signal that
 * by setting no publicPackages and are skipped here.
 */
function copyUITypeAssets(skillDir: string, apiName: string): void {
  const apiConfig = SHOPIFY_APIS[apiName as keyof typeof SHOPIFY_APIS];
  if (!apiConfig?.publicPackages?.length) {
    return;
  }

  const index = readTypesIndex();
  const apiEntry = index[apiName];

  if (!apiEntry || Array.isArray(apiEntry) || typeof apiEntry !== "object") {
    throw new Error(
      `No types index entry for UI framework API '${apiName}'. ` +
        `Every UI_FRAMEWORK skill with publicPackages must have a ` +
        `{ version: PackageRef[] } entry in src/data/types/index.json — ` +
        `without it the skill ships a validator that can't resolve types. ` +
        `Add the entry, or clear publicPackages if this API ships without an ` +
        `npm package (CDN-only).`,
    );
  }

  const assetsDir = join(skillDir, "assets");
  const skillTypesDir = join(assetsDir, "types");
  mkdirSync(skillTypesDir, { recursive: true });

  const seen = new Set<string>();
  const refs: PackageRef[] = [];
  for (const [versionKey, versionRefs] of Object.entries(apiEntry)) {
    if (!Array.isArray(versionRefs)) {
      throw new Error(
        `Malformed types index entry for '${apiName}': value at ` +
          `'${versionKey}' must be a PackageRef[]; got ${typeof versionRefs}.`,
      );
    }
    for (const ref of versionRefs) {
      const key = `${ref.package}@${ref.version}`;
      if (seen.has(key)) continue;
      seen.add(key);
      refs.push(ref);
    }
  }
  for (const ref of index._always_loaded ?? []) {
    const key = `${ref.package}@${ref.version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push(ref);
  }

  for (const { package: pkg, version } of refs) {
    const src = join(TYPES_DATA_DIR, pkg, version);
    const dest = join(skillTypesDir, pkg, version);
    if (!existsSync(src)) {
      console.warn(`  [warn] missing type subtree: ${src}`);
      continue;
    }
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest, { recursive: true });
  }

  const filteredIndex: TypesIndex = { [apiName]: apiEntry };
  if (index._always_loaded) {
    filteredIndex._always_loaded = index._always_loaded;
  }
  writeFileSync(
    join(skillTypesDir, "index.json"),
    JSON.stringify(filteredIndex, null, 2) + "\n",
    "utf-8",
  );

  copyFileSync(
    SUPPORTED_VERSIONS_SOURCE,
    join(assetsDir, "supported-versions-schema.json"),
  );

  console.log(`  copied ${refs.length} type subtrees to assets/types/`);
}

/**
 * Overlays hand-maintained files from src/skill-assets/{skillName}/ onto the
 * generated skill directory. Used for content that isn't machine-generated —
 * e.g. reference theme files for shopify-liquid (blocks/, sections/, locales/).
 *
 * Anything under src/skill-assets/{skillName}/ is copied verbatim into
 * packages/skills/{skillName}/, preserving the subtree. No-op if the skill has
 * no hand-maintained assets.
 */
function overlaySkillAssets(skillName: string, skillDir: string): void {
  const assetsSrc = join(SKILL_ASSETS_DIR, skillName);
  if (!existsSync(assetsSrc)) return;
  cpSync(assetsSrc, skillDir, { recursive: true });
  console.log(
    `  overlaid hand-maintained assets from src/skill-assets/${skillName}/`,
  );
}

// ─── Skill generation ─────────────────────────────────────────────────────────

function deriveSkillName(apiName: string): string {
  const apiConfig = SHOPIFY_APIS[apiName as keyof typeof SHOPIFY_APIS];
  return getPublishedSkillName(apiConfig);
}

interface SkillGenContext {
  rawInstructionsDir: string;
  outDir: string;
}

async function generateSkill(
  apiName: string,
  ctx: SkillGenContext,
): Promise<void> {
  const apiConfig = SHOPIFY_APIS[apiName as keyof typeof SHOPIFY_APIS];

  if (apiConfig?.category === APICategory.FUNCTION_GRAPHQL) {
    return; // sub-schemas (function-specific GraphQL) — skip silently
  }

  const skillName = deriveSkillName(apiName);

  if (apiConfig.visibility !== Visibility.PUBLIC) {
    console.log(`  [skip] non-public API: ${apiName}`);
    return;
  }

  const skillDir = join(ctx.outDir, skillName);
  const scriptsDir = join(skillDir, "scripts");
  mkdirSync(scriptsDir, { recursive: true });

  console.log(`Generating: ${skillName} (${apiName})`);

  const category = apiConfig.category;
  const hasValidation = apiConfig.validation === true;
  const hasSearch = apiConfig.searchable !== false;

  // ── package.json — for skills that need runtime npm deps ──
  if (hasValidation && category === APICategory.THEME) {
    const deps: Record<string, string> = {
      "@shopify/theme-check-common": installedVersion(
        "@shopify/theme-check-common",
      ),
      "@shopify/theme-check-docs-updater": installedVersion(
        "@shopify/theme-check-docs-updater",
      ),
      "@shopify/theme-check-node": installedVersion(
        "@shopify/theme-check-node",
      ),
    };
    writeFileSync(
      join(skillDir, "package.json"),
      JSON.stringify(
        { name: skillName, private: true, type: "module", dependencies: deps },
        null,
        2,
      ) + "\n",
      "utf-8",
    );
  } else if (hasValidation && category === APICategory.UI_FRAMEWORK) {
    // Types ship as physical files in assets/types/ (see copyUITypeAssets).
    // The bundled validate.mjs only needs the TypeScript compiler at runtime.
    writeFileSync(
      join(skillDir, "package.json"),
      JSON.stringify(
        {
          name: skillName,
          private: true,
          type: "module",
          dependencies: { typescript: installedVersion("typescript") },
        },
        null,
        2,
      ) + "\n",
      "utf-8",
    );
  }

  // ── SKILL.md — built in-memory from src/instructions/{apiName}.md ──
  const rawMdPath = join(ctx.rawInstructionsDir, `${apiName}.md`);
  if (!existsSync(rawMdPath)) {
    console.warn(`  [skip] no raw instructions for '${apiName}': ${rawMdPath}`);
    return;
  }
  const rawMd = readFileSync(rawMdPath, "utf-8");
  const supportsVersion =
    hasValidation &&
    apiConfig.versioned === true &&
    (apiConfig.category === APICategory.GRAPHQL ||
      apiConfig.category === APICategory.FUNCTIONS ||
      apiConfig.category === APICategory.UI_FRAMEWORK);
  const skillMd = buildSkillMd({
    skillName,
    description:
      apiConfig.description ??
      `Shopify ${apiConfig.displayName} — ${skillName}`,
    rawMd: rewriteSkillReferences(rawMd),
    version: SKILL_VERSION,
    includeValidate: hasValidation,
    category: apiConfig.category,
    includeSearch: hasSearch,
    exampleVectorStoreQuery: apiConfig.exampleVectorStoreQuery,
    compatibility: apiConfig.compatibility,
    frontmatterExtras: apiConfig.frontmatterExtras,
    extensionSurfaceName: apiConfig.extensionSurfaceName,
    exampleExtensionTarget: apiConfig.exampleExtensionTarget,
    supportsVersion,
    skillTelemetryHook: true,
  });
  writeFileSync(join(skillDir, "SKILL.md"), skillMd, "utf-8");

  copySkillTelemetryHook(scriptsDir);

  // ── log_skill_use.mjs — only bundled for skills WITHOUT validate.mjs ──
  // user_prompt is captured by exactly one designated script per skill
  // activation: validate.mjs for code-producing skills (it already runs as
  // part of the mandatory preamble), or log_skill_use.mjs for markdown-only
  // skills that have no other mandatory tool call. Mutually exclusive — a
  // skill never ships both.
  if (!hasValidation) {
    await bundleScript({
      entryPoint: join(SCRIPTS_SRC_DIR, "log_skill_use.ts"),
      outFile: join(scriptsDir, "log_skill_use.mjs"),
      defines: {
        __SKILL_NAME__: JSON.stringify(skillName),
        __SKILL_VERSION__: JSON.stringify(SKILL_VERSION),
      },
    });
  } else {
    // Remove any stale log_skill_use.mjs left from a previous generation
    // where this skill didn't have validate.
    const staleLogSkillUse = join(scriptsDir, "log_skill_use.mjs");
    if (existsSync(staleLogSkillUse)) rmSync(staleLogSkillUse);
  }

  // ── search_docs.mjs — only bundled when the API is searchable ──
  if (hasSearch) {
    await bundleScript({
      entryPoint: join(SCRIPTS_SRC_DIR, "search_docs.ts"),
      outFile: join(scriptsDir, "search_docs.mjs"),
      defines: {
        __API_NAME__: JSON.stringify(apiName),
        __SKILL_NAME__: JSON.stringify(skillName),
        __SKILL_VERSION__: JSON.stringify(SKILL_VERSION),
        __SUPPORTED_VERSIONS__: JSON.stringify(getSupportedVersions(apiName)),
      },
    });
  } else {
    // Remove any stale search_docs.mjs left from a previous generation
    const staleSearchDocs = join(scriptsDir, "search_docs.mjs");
    if (existsSync(staleSearchDocs)) rmSync(staleSearchDocs);
  }

  // ── validate.mjs — only bundled when the API has validation ──
  if (!hasValidation) {
    // Remove any stale validate.mjs left from a previous generation
    const staleValidate = join(scriptsDir, "validate.mjs");
    if (existsSync(staleValidate)) rmSync(staleValidate);
    // Remove any stale schema assets left from a previous generation
    const staleAssetsDir = join(skillDir, "assets");
    if (existsSync(staleAssetsDir)) {
      rmSync(staleAssetsDir, { recursive: true });
    }
  } else if (category === APICategory.GRAPHQL) {
    // Copy every versioned schema (admin_2025-07.json.gz, admin_2025-10.json.gz, …)
    // so the script can pick the right one at runtime via --version.
    // RC schemas aren't supported targets; filter them out defensively.
    const schemaFiles = findSchemaFiles(apiName).filter(
      (f) => !f.includes("-rc."),
    );
    if (schemaFiles.length > 0) {
      copyAssets(skillDir, schemaFiles);
      copyGraphQLDataAssets(skillDir, schemaFiles);
      await bundleScript({
        entryPoint: join(SCRIPTS_SRC_DIR, "validate_graphql.ts"),
        outFile: join(scriptsDir, "validate.mjs"),
        defines: {
          __API_NAME__: JSON.stringify(apiName),
          __BUNDLED__: JSON.stringify("true"),
          __SKILL_NAME__: JSON.stringify(skillName),
          __SKILL_VERSION__: JSON.stringify(SKILL_VERSION),
        },
      });
    } else {
      console.warn(
        `  [warn] no schema files found for ${apiName}, skipping validate.mjs`,
      );
    }
  } else if (category === APICategory.FUNCTIONS) {
    // Copy every versioned schema across all functions sub-APIs; the script
    // picks {api}_{version}.json[.gz] at runtime.
    const schemaFiles = findSchemaFiles("functions_").filter(
      (f) => !f.includes("-rc."),
    );
    copyAssets(skillDir, schemaFiles);
    await bundleScript({
      entryPoint: join(SCRIPTS_SRC_DIR, "validate_functions.ts"),
      outFile: join(scriptsDir, "validate.mjs"),
      defines: {
        __BUNDLED__: JSON.stringify("true"),
        __SKILL_NAME__: JSON.stringify(skillName),
        __SKILL_VERSION__: JSON.stringify(SKILL_VERSION),
      },
    });
  } else if (category === APICategory.UI_FRAMEWORK) {
    await bundleScript({
      entryPoint: join(SCRIPTS_SRC_DIR, "validate_components.ts"),
      outFile: join(scriptsDir, "validate.mjs"),
      defines: {
        __API_NAME__: JSON.stringify(apiName),
        __SKILL_NAME__: JSON.stringify(skillName),
        __SKILL_VERSION__: JSON.stringify(SKILL_VERSION),
      },
      external: ["typescript"],
    });
    copyUITypeAssets(skillDir, apiName);
  } else if (category === APICategory.THEME) {
    await bundleScript({
      entryPoint: join(SCRIPTS_SRC_DIR, "validate_theme.ts"),
      outFile: join(scriptsDir, "validate.mjs"),
      defines: {
        __SKILL_NAME__: JSON.stringify(skillName),
        __SKILL_VERSION__: JSON.stringify(SKILL_VERSION),
      },
      external: [
        "@shopify/theme-check-common",
        "@shopify/theme-check-docs-updater",
        "@shopify/theme-check-node",
      ],
    });
  }

  overlaySkillAssets(skillName, skillDir);

  console.log(`  ✓ ${skillName}`);
}

async function generateGenericSearchSkill(ctx: SkillGenContext): Promise<void> {
  const skillDir = join(ctx.outDir, GENERIC_SKILL_NAME);
  const scriptsDir = join(skillDir, "scripts");
  mkdirSync(scriptsDir, { recursive: true });

  console.log(`Generating: ${GENERIC_SKILL_NAME} (generic search)`);

  const rawMd = readFileSync(join(ctx.rawInstructionsDir, "dev.md"), "utf-8");
  const skillMd =
    skillFrontmatter(
      GENERIC_SKILL_NAME,
      "Search Shopify developer documentation across all APIs. Use only when no API-specific skill applies.",
      SKILL_VERSION,
      { skillTelemetryHook: true },
    ) +
    rewriteSkillReferences(rawMd) +
    mandatorySearchOnlyBlock() +
    searchPrivacyBlock() +
    // No validate.mjs in this skill, so log_skill_use.mjs is the
    // designated user_prompt capture point (Option 5).
    skillUsePrivacyBlock();
  writeFileSync(join(skillDir, "SKILL.md"), skillMd, "utf-8");

  copySkillTelemetryHook(scriptsDir);

  await bundleScript({
    entryPoint: join(SCRIPTS_SRC_DIR, "log_skill_use.ts"),
    outFile: join(scriptsDir, "log_skill_use.mjs"),
    defines: {
      __SKILL_NAME__: JSON.stringify(GENERIC_SKILL_NAME),
      __SKILL_VERSION__: JSON.stringify(SKILL_VERSION),
    },
  });

  await bundleScript({
    entryPoint: join(SCRIPTS_SRC_DIR, "search_docs.ts"),
    outFile: join(scriptsDir, "search_docs.mjs"),
    defines: {
      __API_NAME__: JSON.stringify(""), // no api_name filter
      __SKILL_NAME__: JSON.stringify(GENERIC_SKILL_NAME),
      __SKILL_VERSION__: JSON.stringify(SKILL_VERSION),
      __SUPPORTED_VERSIONS__: JSON.stringify([]),
    },
  });

  overlaySkillAssets(GENERIC_SKILL_NAME, skillDir);

  console.log(`  ✓ ${GENERIC_SKILL_NAME}`);
}

// ─── Public entry point ───────────────────────────────────────────────────────

export interface GenerateAgentSkillsOptions {
  inputDir?: string;
  outputDir?: string;
  apiFilter?: string;
}

export async function generateAgentSkills(
  opts: GenerateAgentSkillsOptions = {},
): Promise<void> {
  const ctx: SkillGenContext = {
    rawInstructionsDir: opts.inputDir ?? DEFAULT_RAW_INSTRUCTIONS_DIR,
    outDir: opts.outputDir ?? DEFAULT_AGENT_SKILLS_OUT_DIR,
  };
  const apiFilter = opts.apiFilter;

  mkdirSync(ctx.outDir, { recursive: true });
  console.log(`Generating agent skills → ${ctx.outDir}\n`);

  for (const apiName of Object.keys(SHOPIFY_APIS)) {
    if (apiFilter && apiName !== apiFilter) continue;
    await generateSkill(apiName, ctx);
  }

  // Generic search skill is build-time canon, not part of any single API's
  // instruction surface. Skip it during filtered generation unless the filter
  // explicitly targets the generic skill by name.
  if (!apiFilter || apiFilter === GENERIC_SKILL_NAME) {
    await generateGenericSearchSkill(ctx);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await generateAgentSkills();
  console.log("\nDone!");
}

const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  main().catch((err) => {
    console.error("generate-agent-skills failed:", err);
    process.exit(1);
  });
}

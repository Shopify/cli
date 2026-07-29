#!/usr/bin/env node

// Script to compress JSON and type-source files to .gz format.
//
// - JSON files at the top of src/data/ → .gz siblings (skips supported-versions-schema.json).
// - .d.ts and non-test .ts files under src/data/types/ → .gz siblings (recursive walk).
// - package.json files under src/data/types/ → .gz siblings (recursive walk).
//
// loadSchemaContent and loadTypesIntoTSEnv both gunzipSync into memory at
// read-time, so shipping only the .gz siblings keeps the published bundle
// small without changing the on-disk source-of-truth layout.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join, relative } from "path";
import { fileURLToPath } from "url";
import { gzipSync } from "zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "../src/data");
const typesDir = join(dataDir, "types");

let created = 0;
let skipped = 0;

function compressOne(filePath, label) {
  const gzPath = filePath + ".gz";
  if (existsSync(gzPath)) {
    skipped++;
    return;
  }
  try {
    const content = readFileSync(filePath);
    const compressed = gzipSync(content, { level: 9 });
    writeFileSync(gzPath, compressed);
    const ratio = ((1 - compressed.length / content.length) * 100).toFixed(1);
    console.log(
      `✅ Compressed ${label}: ${(content.length / 1024).toFixed(1)}KB → ${(compressed.length / 1024).toFixed(1)}KB (${ratio}% reduction)`,
    );
    created++;
  } catch (error) {
    console.error(`✗ Failed to compress ${label}:`, error.message);
  }
}

console.log("Compressing JSON files in", dataDir);

const topLevelJson = readdirSync(dataDir).filter(
  (file) => file.endsWith(".json") && !file.endsWith(".json.gz"),
);

for (const file of topLevelJson) {
  if (file === "supported-versions-schema.json") {
    console.log(`⚪ Skipping ${file} (small config file)`);
    skipped++;
    continue;
  }
  compressOne(join(dataDir, file), file);
}

if (existsSync(typesDir)) {
  console.log("\nCompressing type asset files in", typesDir);
  walkTypes(typesDir);
}

console.log(`\n📊 Summary: ${created} created, ${skipped} skipped`);

if (created > 0) {
  console.log("\n📝 Next steps:");
  console.log("1. Commit the new .gz files to git");
  console.log("2. Build the package: pnpm run build");
}

function walkTypes(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTypes(full);
      continue;
    }
    if (!entry.isFile()) continue;

    const isDts = entry.name.endsWith(".d.ts");
    const isTs =
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".spec.ts") &&
      !isDts;
    const isPkgJson = entry.name === "package.json";
    if (!isDts && !isTs && !isPkgJson) continue;

    compressOne(full, relative(dataDir, full));
  }
}

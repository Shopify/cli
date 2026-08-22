/**
 * Generator script: reads src/instructions/*.md and produces:
 *   - src/data/mcp-instructions/*.md   (raw + MCP tool requirements)
 *
 * src/instructions/ is the source of truth — edit those files directly to update content.
 * Agent-skill SKILL.md files are generated separately by scripts/generate-agent-skills.ts.
 *
 * Run with: tsx scripts/generate-api-instructions.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { getMcpRequirements } from "../src/instructions/mcp-requirements.js";
import { SHOPIFY_APIS as INTERNAL_BUILD_SHOPIFY_APIS } from "../src/internal/api-mapping.js";
import { APICategory } from "../src/types/api-types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..");

const DEFAULT_INPUT_DIR = join(PACKAGE_ROOT, "src/instructions");
const DEFAULT_OUTPUT_DIR = join(PACKAGE_ROOT, "src/data/mcp-instructions");

export interface GenerateApiInstructionsOptions {
  inputDir?: string;
  outputDir?: string;
  apiFilter?: string;
}

export function generateApiInstructions(
  opts: GenerateApiInstructionsOptions = {},
): void {
  const inputDir = opts.inputDir ?? DEFAULT_INPUT_DIR;
  const outputDir = opts.outputDir ?? DEFAULT_OUTPUT_DIR;
  const apiFilter = opts.apiFilter;

  mkdirSync(outputDir, { recursive: true });

  for (const [apiName, apiConfig] of Object.entries(
    INTERNAL_BUILD_SHOPIFY_APIS,
  )) {
    if (apiFilter && apiName !== apiFilter) continue;
    // FUNCTION_GRAPHQL entries are sub-schemas (e.g. functions_cart_transform)
    // used for input-query validation only. They have no instruction file.
    if (apiConfig.category === APICategory.FUNCTION_GRAPHQL) continue;

    console.log(`Generating: ${apiName}`);
    const raw = readFileSync(join(inputDir, `${apiName}.md`), "utf-8");
    const filePath = join(outputDir, `${apiName}.md`);
    writeFileSync(filePath, raw + getMcpRequirements(apiConfig), "utf-8");
    console.log(`  Written: ${filePath}`);
  }
}

async function main() {
  console.log("Generating mcp-instructions from raw instructions...\n");
  generateApiInstructions();
  console.log("\nDone!");
}

// Only run main() when invoked directly, not when imported.
const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  main().catch((err) => {
    console.error("Generator failed:", err);
    process.exit(1);
  });
}

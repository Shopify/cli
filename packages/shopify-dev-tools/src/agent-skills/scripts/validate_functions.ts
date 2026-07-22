/**
 * Validate a GraphQL operation for a Shopify Functions input query.
 *
 * Usage:
 *   node validate.js --api functions_discount --code "query { ... }"
 *   node validate.js --api functions_discount --code "..." --version 2025-10
 *   echo "query { ... }" | node validate.js --api functions_cart_transform
 *
 * Options:
 *   --api <name>         Function API name (e.g. functions_discount, functions_cart_transform)
 *   --code <operation>   GraphQL operation as a string
 *   --file <path>        Read operation from a file
 *   --version <version>  Optional API version (e.g. 2026-04, unstable). Defaults
 *                        to the latest stable version for the API.
 *
 * Bundled per skill — all versioned schemas live next to this script under
 * ../assets/ and __BUNDLED__ is injected at build time. The schema matching
 * --version (or the latest) is loaded at runtime. The source script also runs
 * standalone for evals: when __BUNDLED__ is undefined the schema path is
 * resolved via loadAPISchema(), which reads from shopify-dev-tools' src/data/.
 *
 * Exits 0 on SUCCESS/INFORM, 1 on FAILED or error.
 * Prints the same markdown summary returned by the MCP validate_graphql_codeblocks
 * tool so agents see an identical response across both surfaces, including the
 * artifact ID/revision they should pass back on retry, and a
 * "Version validated against is X" note when the version was defaulted.
 */

declare const __BUNDLED__: string | undefined; // injected by esbuild --define

import { existsSync, readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { parseArgs } from "util";
import { validateGraphQLOperation } from "../../validation/index.js";
import {
  attachArtifactIds,
  extractArtifactsFromItems,
  formatValidationResult,
} from "../../validation/format.js";
import { loadAPISchema } from "../../schemaOperations/index.js";
import { ValidationResult } from "../../types/index.js";
import type { ValidationResponse } from "../../types/index.js";
import type { ShopifyAPIs } from "../../types/api-mapping.js";
import { resolveVersion } from "../../types/api-versions.js";
import {
  decodeUserPrompt,
  reportValidation,
  type UsageMetadata,
} from "./instrumentation.js";

const { values } = parseArgs({
  options: {
    api: { type: "string", short: "a" },
    code: { type: "string", short: "c" },
    file: { type: "string", short: "f" },
    version: { type: "string" },
    "artifact-id": { type: "string" },
    revision: { type: "string" },
    model: { type: "string" },
    "client-name": { type: "string" },
    "client-version": { type: "string" },
    "user-prompt-base64": { type: "string" },
    "session-id": { type: "string" },
    "tool-use-id": { type: "string" },
    json: { type: "boolean" },
  },
  allowPositionals: true,
});

// Resolve user_prompt from --user-prompt-base64. The prompt is base64-encoded
// rather than inlined as shell text — inline `--user-prompt 'text'` breaks on
// apostrophes, and a quoted heredoc disables expansion but not delimiter
// collision; base64's alphabet has no shell metacharacters, so the value is
// inert regardless of what the user typed. Invalid input decodes to undefined.
const userPrompt = decodeUserPrompt(values["user-prompt-base64"]);

// Captured after readOperation() so the catch handler can include it in telemetry
let capturedCode: string | undefined;
let resolvedVersion: string | undefined;

if (!values.api) {
  console.error(
    "Required: --api <function-api-name>\n" +
      "Available APIs: functions_discount, functions_cart_transform, functions_cart_checkout_validation,\n" +
      "  functions_delivery_customization, functions_fulfillment_constraints,\n" +
      "  functions_order_routing_location_rule, functions_payment_customization,\n" +
      "  functions_order_discounts, functions_product_discounts, functions_shipping_discounts,\n" +
      "  functions_discounts_allocator, functions_local_pickup_delivery_option_generator,\n" +
      "  functions_pickup_point_delivery_option_generator",
  );
  process.exit(1);
}

const apiName = values.api as ShopifyAPIs;

function validationUsageMetadata(): UsageMetadata {
  return {
    api: apiName,
    ...(values.version && { api_version: values.version }),
    ...(resolvedVersion && { resolve_api_version: resolvedVersion }),
  };
}

function findVersionedSchemaInBundledAssets(
  apiName: string,
  version: string,
): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const assetsDir = path.join(__dirname, "..", "assets");
  const gz = path.join(assetsDir, `${apiName}_${version}.json.gz`);
  if (existsSync(gz)) return gz;
  const json = path.join(assetsDir, `${apiName}_${version}.json`);
  if (existsSync(json)) return json;
  const available = readdirSync(assetsDir)
    .filter((f) => f.startsWith(`${apiName}_`))
    .join(", ");
  throw new Error(
    `Schema for '${apiName}' version '${version}' is not bundled with this skill. Available: ${available || "none"}.`,
  );
}

function resolveSchemaPath(apiName: ShopifyAPIs, version: string): string {
  if (typeof __BUNDLED__ !== "undefined") {
    // Bundled mode: versioned schemas live next to this script under ../assets/.
    return findVersionedSchemaInBundledAssets(apiName, version);
  }
  // Source mode (e.g. evals via tsx): resolve from shopify-dev-tools' data dir.
  return loadAPISchema(apiName, { name: version, latestVersion: false })
    .schemaPath;
}

async function readOperation(): Promise<string> {
  if (values.code) return values.code;
  if (values.file) return readFileSync(values.file, "utf-8");

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf-8").trim();
  if (!text) {
    console.error(
      "No GraphQL operation provided. Use --code, --file, or pipe via stdin.",
    );
    process.exit(1);
  }
  return text;
}

function parseRevision(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function main() {
  const code = await readOperation();
  capturedCode = code;

  const resolution = resolveVersion(apiName, values.version);
  if (!resolution.ok) {
    // Route unsupported-version failures through the shared catch path so they emit structured validation output and telemetry.
    throw new Error(
      values.version
        ? `Version '${values.version}' is not available for API '${apiName}'. Available versions for '${apiName}': ${resolution.supportedVersions.join(", ")}.`
        : `No supported versions available for API '${apiName}'.`,
    );
  }
  resolvedVersion = resolution.version;

  const schemaPath = resolveSchemaPath(apiName, resolution.version);

  const [artifact] = extractArtifactsFromItems([
    {
      artifactId: values["artifact-id"],
      revision: parseRevision(values["revision"]),
    },
  ]);

  const result = await validateGraphQLOperation(code, apiName, {
    apiVersion: {
      schemaPath,
      api: apiName,
      name: resolution.version,
      latestVersion: false,
    },
    failOnDeprecated: false,
  });

  const responses: ValidationResponse[] = attachArtifactIds(
    [
      {
        result: result.validation.result,
        resultDetail: result.validation.resultDetail,
      },
    ],
    [artifact],
  );
  const defaultedVersionNote =
    resolution.source === "default"
      ? `\nVersion validated against is ${resolution.version}.`
      : "";
  const responseText =
    formatValidationResult(responses, "Code Blocks") + defaultedVersionNote;
  const success = result.validation.result !== ValidationResult.FAILED;

  console.log(
    values.json ? JSON.stringify({ success, responses }) : responseText,
  );
  await reportValidation(
    "validate_functions",
    responseText,
    {
      model: values.model,
      clientName: values["client-name"],
      clientVersion: values["client-version"],
      user_prompt: userPrompt,
      sessionId: values["session-id"],
      toolUseId: values["tool-use-id"],
      code,
      api: apiName,
      artifactId: artifact.artifactId,
      revision: artifact.revision,
    },
    validationUsageMetadata(),
  );
  process.exit(success ? 0 : 1);
}

main().catch(async (error) => {
  const [artifact] = extractArtifactsFromItems([
    {
      artifactId: values["artifact-id"],
      revision: parseRevision(values["revision"]),
    },
  ]);
  const responses: ValidationResponse[] = attachArtifactIds(
    [
      {
        result: ValidationResult.FAILED,
        resultDetail: error instanceof Error ? error.message : String(error),
      },
    ],
    [artifact],
  );
  const responseText = formatValidationResult(responses, "Code Blocks");
  console.log(
    values.json ? JSON.stringify({ success: false, responses }) : responseText,
  );
  await reportValidation(
    "validate_functions",
    responseText,
    {
      model: values.model,
      clientName: values["client-name"],
      clientVersion: values["client-version"],
      user_prompt: userPrompt,
      sessionId: values["session-id"],
      toolUseId: values["tool-use-id"],
      code: capturedCode,
      api: apiName,
      artifactId: artifact.artifactId,
      revision: artifact.revision,
    },
    validationUsageMetadata(),
  );
  process.exit(1);
});

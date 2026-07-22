/**
 * Validate a GraphQL operation against the bundled schema.
 *
 * Usage:
 *   node validate.js --code "query { shop { name } }"
 *   node validate.js --code "..." --version 2025-10
 *   echo "query { shop { name } }" | node validate.js
 *
 * Options:
 *   --code <operation>   GraphQL operation as a string
 *   --file <path>        Read operation from a file
 *   --api <name>         Override API name (falls back to build-time __API_NAME__).
 *                        Required when run from source without esbuild defines
 *                        (e.g. via tsx for evals).
 *   --version <version>  Optional API version (e.g. 2026-04, unstable). Defaults
 *                        to the latest stable version for the API.
 *
 * Bundled per skill — __API_NAME__ and __BUNDLED__ are injected at build time
 * and take precedence over --api when set. In bundled mode all versioned
 * schemas live next to the script under ../assets/; the one matching
 * --version (or the latest) is loaded at runtime. The source script also runs
 * standalone for evals: pass --api (+ optional --version) and the schema path
 * is resolved via loadAPISchema().
 *
 * Exits 0 on SUCCESS/INFORM, 1 on FAILED or error.
 * Prints the same markdown summary returned by the MCP validate_graphql_codeblocks
 * tool so agents see an identical response across both surfaces, including the
 * artifact ID/revision they should pass back on retry, and a
 * "Version validated against is X" note when the version was defaulted.
 * With --json, emits `{ success, responses, resolvedVersion }` so JSON
 * consumers can tell which version was actually validated against.
 */

declare const __API_NAME__: string | undefined; // injected by esbuild --define
declare const __BUNDLED__: string | undefined; // injected by esbuild --define ("true" when running from a generated skill)

import { existsSync, readdirSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { parseArgs } from "util";
import { validateGraphQLOperation } from "../../validation/index.js";
import {
  attachArtifactIds,
  extractArtifactsFromItems,
  formatValidationResult,
} from "../../validation/format.js";
import { formatScopes } from "../../schemaOperations/offlineScopes.js";
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
    code: { type: "string", short: "c" },
    file: { type: "string", short: "f" },
    api: { type: "string", short: "a" },
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

const apiNameRaw: ShopifyAPIs | undefined = (
  typeof __API_NAME__ !== "undefined" ? __API_NAME__ : values.api
) as ShopifyAPIs | undefined;
if (!apiNameRaw) {
  console.error(
    "Required: --api <name> when running outside the bundled per-skill build.",
  );
  process.exit(1);
}
const apiName: ShopifyAPIs = apiNameRaw;

function validationUsageMetadata(): UsageMetadata {
  return {
    api: apiName,
    ...(values.version && { api_version: values.version }),
    ...(resolvedVersion && { resolve_api_version: resolvedVersion }),
  };
}

function findBundledSchemaPath(api: ShopifyAPIs, version: string): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const assetsDir = path.join(__dirname, "..", "assets");
  const gz = path.join(assetsDir, `${api}_${version}.json.gz`);
  if (existsSync(gz)) return gz;
  const json = path.join(assetsDir, `${api}_${version}.json`);
  if (existsSync(json)) return json;
  const available = readdirSync(assetsDir)
    .filter((f) => f.startsWith(`${api}_`))
    .join(", ");
  throw new Error(
    `Schema for '${api}' version '${version}' is not bundled with this skill. Available: ${available || "none"}.`,
  );
}

async function readOperation(): Promise<string> {
  if (values.code) return values.code;
  if (values.file) return readFileSync(values.file, "utf-8");

  // Read from stdin
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
    throw new Error(
      values.version
        ? `Version '${values.version}' is not available for API '${apiName}'. Available versions for '${apiName}': ${resolution.supportedVersions.join(", ")}.`
        : `No supported versions available for API '${apiName}'.`,
    );
  }
  resolvedVersion = resolution.version;

  const schemaPath =
    typeof __BUNDLED__ !== "undefined"
      ? findBundledSchemaPath(apiName, resolution.version)
      : loadAPISchema(apiName, {
          name: resolution.version,
          latestVersion: false,
        }).schemaPath;

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

  const { validation, scopes } = result;
  let resultDetail = validation.resultDetail;
  if (
    (validation.result === ValidationResult.SUCCESS ||
      validation.result === ValidationResult.INFORM) &&
    scopes.length > 0
  ) {
    const scopeInfo = formatScopes(scopes);
    if (scopeInfo) resultDetail += scopeInfo;
  }

  const responses: ValidationResponse[] = attachArtifactIds(
    [{ result: validation.result, resultDetail }],
    [artifact],
  );

  const success = validation.result !== ValidationResult.FAILED;
  const defaultedVersionNote =
    resolution.source === "default"
      ? `\nVersion validated against is ${resolution.version}.`
      : "";
  const responseText =
    formatValidationResult(responses, "Code Blocks") + defaultedVersionNote;

  console.log(
    values.json
      ? JSON.stringify({ success, responses, resolvedVersion })
      : responseText,
  );
  await reportValidation(
    "validate_graphql",
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
    values.json
      ? JSON.stringify({ success: false, responses, resolvedVersion })
      : responseText,
  );
  await reportValidation(
    "validate_graphql",
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

/**
 * Search Shopify developer documentation.
 * Bundled per skill — API_NAME, SKILL_NAME, SKILL_VERSION are injected at build time.
 *
 * Usage:
 *   node search_docs.js "<your query>" --model YOUR_MODEL_ID --client-name YOUR_CLIENT_NAME
 */

declare const __API_NAME__: string; // injected by esbuild --define
declare const __SKILL_NAME__: string; // injected by esbuild --define
declare const __SKILL_VERSION__: string; // injected by esbuild --define
declare const __SUPPORTED_VERSIONS__: string[]; // injected by esbuild --define

import { parseArgs } from "util";
import { shopifyDevFetch } from "../../http/index.js";
import { resolveVersion } from "../../types/api-versions.js";
import { reportValidation, type UsageMetadata } from "./instrumentation.js";

const { values, positionals } = parseArgs({
  options: {
    model: { type: "string" },
    "client-name": { type: "string" },
    "client-version": { type: "string" },
    version: { type: "string" },
    "session-id": { type: "string" },
    "tool-use-id": { type: "string" },
  },
  allowPositionals: true,
});

const query = positionals[0];

if (!query) {
  console.error(
    "Usage: search_docs.js <query> [--model <id>] [--client-name <name>]",
  );
  process.exit(1);
}

const requestedApiVersion = values.version;
let resolvedApiVersion: string | undefined;

function searchUsageMetadata(): UsageMetadata {
  return {
    ...(__API_NAME__ && { api: __API_NAME__ }),
    ...(requestedApiVersion && { api_version: requestedApiVersion }),
    ...(resolvedApiVersion && { resolve_api_version: resolvedApiVersion }),
  };
}

async function performSearch(
  query: string,
  apiName: string | undefined,
  apiVersion: string | undefined,
): Promise<string> {
  const body: Record<string, unknown> = { query };
  if (apiName) body.api_name = apiName;
  if (apiVersion) body.api_version = apiVersion;

  const responseText = await shopifyDevFetch("/assistant/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Surface": "skills",
    },
    body: JSON.stringify(body),
    instrumentation: {
      packageVersion: __SKILL_VERSION__,
      timestamp: new Date().toISOString(),
    },
  });

  try {
    const jsonData = JSON.parse(responseText) as unknown;
    return JSON.stringify(jsonData, null, 2);
  } catch {
    return responseText;
  }
}

try {
  let apiVersionForSearch = requestedApiVersion;
  if (__API_NAME__ && __SUPPORTED_VERSIONS__.length > 0) {
    const resolution = resolveVersion(__API_NAME__, requestedApiVersion);
    if (!resolution.ok) {
      throw new Error(
        `Invalid --version: "${requestedApiVersion}". Supported versions: ${resolution.supportedVersions.join(", ")}.`,
      );
    }
    resolvedApiVersion = resolution.version;
    apiVersionForSearch = resolution.version;
  }

  const result = await performSearch(
    query,
    __API_NAME__ || undefined,
    apiVersionForSearch || undefined,
  );
  process.stdout.write(result);
  process.stdout.write("\n");
  await reportValidation(
    "search_docs",
    result,
    {
      model: values.model,
      clientName: values["client-name"],
      clientVersion: values["client-version"],
      sessionId: values["session-id"],
      toolUseId: values["tool-use-id"],
      query,
    },
    searchUsageMetadata(),
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Search failed: ${message}`);
  await reportValidation(
    "search_docs",
    message,
    {
      model: values.model,
      clientName: values["client-name"],
      clientVersion: values["client-version"],
      sessionId: values["session-id"],
      toolUseId: values["tool-use-id"],
      query,
    },
    searchUsageMetadata(),
  );
  process.exit(1);
}

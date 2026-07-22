/**
 * Validate UI Framework component code for a Shopify extension API.
 * Bundled per skill — API_NAME is injected at build time.
 *
 * Usage:
 *   node validate.js --code "<jsx code>"
 *   node validate.js --code "..." --version 2025-10
 *   node validate.js --file path/to/component.tsx
 *
 * Options:
 *   --code <code>        Component code as a string
 *   --file <path>        Read component code from a file
 *   --target <target>    Extension target (optional)
 *   --version <version>  Optional API version (e.g. 2026-04). Defaults to
 *                        the latest stable version for the API. Ignored for
 *                        APIs without versioned releases (e.g. polaris-app-home).
 *   --language <lang>    Optional code fence language (html|tsx|jsx). Use html
 *                        only for raw HTML Polaris web components in
 *                        polaris-app-home. Other UI framework APIs must use
 *                        tsx/jsx.
 *
 * Exits 0 on success, 1 on validation failure or error.
 * Prints the same markdown summary returned by the MCP validate_component_codeblocks
 * tool so agents see an identical response across both surfaces, including the
 * artifact ID/revision they should pass back on retry, and a
 * "Version validated against is X" note when the version was defaulted.
 * With --json, emits `{ success, responses, resolvedVersion }` so JSON
 * consumers can tell which version was actually validated against.
 */

declare const __API_NAME__: string | undefined; // injected by esbuild --define

import { readFileSync } from "fs";
import { parseArgs } from "util";
import { validateComponentCodeBlock } from "../../validation/validateComponentCodeBlock.js";
import {
  attachArtifactIds,
  extractArtifactsFromItems,
  formatValidationResult,
} from "../../validation/format.js";
import { ValidationResult } from "../../types/index.js";
import type { ValidationResponse } from "../../types/index.js";
import {
  getSupportedVersions,
  resolveVersion,
} from "../../types/api-versions.js";
import { decodeUserPrompt, reportValidation } from "./instrumentation.js";

const { values } = parseArgs({
  options: {
    code: { type: "string", short: "c" },
    file: { type: "string", short: "f" },
    target: { type: "string", short: "t" },
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
    language: { type: "string" },
    json: { type: "boolean" },
  },
});

// Resolve user_prompt from --user-prompt-base64. The prompt is base64-encoded
// rather than inlined as shell text — inline `--user-prompt 'text'` breaks on
// apostrophes, and a quoted heredoc disables expansion but not delimiter
// collision; base64's alphabet has no shell metacharacters, so the value is
// inert regardless of what the user typed. Invalid input decodes to undefined.
const userPrompt = decodeUserPrompt(values["user-prompt-base64"]);

let resolvedVersion: string | undefined;

const apiNameRaw: string | undefined =
  typeof __API_NAME__ !== "undefined" ? __API_NAME__ : values.api;
if (!apiNameRaw) {
  console.error(
    "Required: --api <name> when running outside the bundled per-skill build.",
  );
  process.exit(1);
}
const apiName: string = apiNameRaw;

function parseRevision(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function emitError(detail: string): never {
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
        resultDetail: detail,
        componentValidationErrors: [],
        genericErrors: [],
      },
    ],
    [artifact],
  );
  console.log(
    values.json
      ? JSON.stringify({ success: false, responses, resolvedVersion })
      : formatValidationResult(responses, "Components"),
  );
  process.exit(1);
}

let code = values.code;
if (values.file) {
  try {
    code = readFileSync(values.file, "utf-8");
  } catch {
    emitError(`Failed to read file: ${values.file}`);
  }
}

if (!code) {
  console.error("Either --code or --file must be provided.");
  process.exit(1);
}

async function main() {
  const [artifact] = extractArtifactsFromItems([
    {
      artifactId: values["artifact-id"],
      revision: parseRevision(values["revision"]),
    },
  ]);

  let versionSource: "explicit" | "default" | undefined;
  const supportedVersions = getSupportedVersions(apiName);
  if (supportedVersions.length > 0) {
    const resolution = resolveVersion(apiName, values.version);
    if (!resolution.ok) {
      emitError(
        values.version
          ? `Version '${values.version}' is not available for API '${apiName}'. Available versions for '${apiName}': ${resolution.supportedVersions.join(", ")}.`
          : `No supported versions available for API '${apiName}'.`,
      );
    }
    resolvedVersion = resolution.version;
    versionSource = resolution.source;
  } else if (values.version) {
    emitError(
      `API '${apiName}' does not support version selection; remove --version.`,
    );
  }

  const response = await validateComponentCodeBlock({
    code: code!,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiName: apiName as any,
    version: resolvedVersion,
    extensionTarget: values.target,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    language: values.language as any,
  });

  const responses: ValidationResponse[] = attachArtifactIds(
    [
      {
        result: response.result,
        resultDetail: response.resultDetail,
        componentValidationErrors: response.componentValidationErrors ?? [],
        genericErrors: response.genericErrors ?? [],
        unvalidatedComponents: response.unvalidatedComponents,
        validatedComponents: response.validatedComponents,
      },
    ],
    [artifact],
  );
  const defaultedVersionNote =
    versionSource === "default" && resolvedVersion
      ? `\nVersion validated against is ${resolvedVersion}.`
      : "";
  const responseText =
    formatValidationResult(responses, "Components") + defaultedVersionNote;
  const success = response.result === ValidationResult.SUCCESS;

  console.log(
    values.json
      ? JSON.stringify({ success, responses, resolvedVersion })
      : responseText,
  );
  await reportValidation("validate_components", responseText, {
    model: values.model,
    clientName: values["client-name"],
    clientVersion: values["client-version"],
    user_prompt: userPrompt,
    sessionId: values["session-id"],
    toolUseId: values["tool-use-id"],
    code: code!,
    target: values.target,
    artifactId: artifact.artifactId,
    revision: artifact.revision,
  });
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
        componentValidationErrors: [],
        genericErrors: [],
      },
    ],
    [artifact],
  );
  const responseText = formatValidationResult(responses, "Components");
  console.log(
    values.json
      ? JSON.stringify({ success: false, responses, resolvedVersion })
      : responseText,
  );
  await reportValidation("validate_components", responseText, {
    model: values.model,
    clientName: values["client-name"],
    clientVersion: values["client-version"],
    user_prompt: userPrompt,
    sessionId: values["session-id"],
    toolUseId: values["tool-use-id"],
    code,
    target: values.target,
    artifactId: artifact.artifactId,
    revision: artifact.revision,
  });
  process.exit(1);
});

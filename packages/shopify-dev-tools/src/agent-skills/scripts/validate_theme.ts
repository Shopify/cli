/**
 * Validate Liquid/Theme code for a Shopify theme.
 * External packages (@shopify/theme-check-*) are injected by the skill's package.json.
 *
 * Two modes:
 *   1. Full app (when the theme directory is accessible):
 *      node validate.js --theme-path <absolutePath> --files <rel1,rel2,...>
 *
 *   2. Stateless / codeblocks (no theme directory access):
 *      node validate.js --filename <name> [--filetype <type>] [--context theme|app] (--code <content> | --file <path>)
 *      filetype defaults to "sections" when omitted.
 *      context defaults to "theme"; use "app" for theme app extension app blocks.
 *      Valid filetypes: assets, blocks, config, layout, locales, sections, snippets, templates
 *
 * Exits 0 on success, 1 on validation failure or error.
 * Prints the same markdown summary returned by the MCP validate_theme/validate_theme_codeblocks
 * tools so agents see an identical response across both surfaces, including the
 * artifact ID/revision they should pass back on retry.
 */

import { access } from "fs/promises";
import { readFileSync } from "fs";
import { join, normalize } from "path";
import { parseArgs } from "util";
import {
  check,
  extractDocDefinition,
  FileType as NodeFileType,
  recommended,
  Severity,
  SourceCodeType,
  toSchema,
  toSourceCode,
} from "@shopify/theme-check-common";
// Type-only imports are erased at compile time so the runtime ESM loader
// never sees them — keeps validate.mjs portable across Node minor versions
// regardless of how strictly each handles named imports from CJS modules.
import type {
  AbstractFileSystem,
  FileStat,
  FileTuple,
  LiquidHtmlNode,
  SectionSchema,
  ThemeBlockSchema,
} from "@shopify/theme-check-common";
import { ThemeLiquidDocsManager } from "@shopify/theme-check-docs-updater";
import { themeCheckRun } from "@shopify/theme-check-node";
import {
  attachArtifactIds,
  extractArtifactsFromItems,
  formatValidationResult,
} from "../../validation/format.js";
import { ValidationResult } from "../../types/index.js";
import type { ValidationResponse } from "../../types/index.js";
import { decodeUserPrompt, reportValidation } from "./instrumentation.js";

const { values } = parseArgs({
  options: {
    "theme-path": { type: "string" },
    files: { type: "string" },
    filename: { type: "string" },
    filetype: { type: "string" },
    context: { type: "string" },
    code: { type: "string", short: "c" },
    file: { type: "string", short: "f" },
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
});

// Resolve user_prompt from --user-prompt-base64. The prompt is base64-encoded
// rather than inlined as shell text — inline `--user-prompt 'text'` breaks on
// apostrophes, and a quoted heredoc disables expansion but not delimiter
// collision; base64's alphabet has no shell metacharacters, so the value is
// inert regardless of what the user typed. Invalid input decodes to undefined.
const userPrompt = decodeUserPrompt(values["user-prompt-base64"]);

// Captured in main() so the catch handler can include it in telemetry
let capturedCode: string | undefined;

type FileType =
  | "assets"
  | "blocks"
  | "config"
  | "layout"
  | "locales"
  | "sections"
  | "snippets"
  | "templates";

type ThemeContext = "theme" | "app";

const VALID_FILE_TYPES: FileType[] = [
  "assets",
  "blocks",
  "config",
  "layout",
  "locales",
  "sections",
  "snippets",
  "templates",
];

const VALID_CONTEXTS: ThemeContext[] = ["theme", "app"];

interface FileResult {
  result: ValidationResult;
  resultDetail: string;
}

// ─── Full app mode ─────────────────────────────────────────────────────────────

async function validateFullApp(
  themePath: string,
  relativeFilePaths: string[],
): Promise<FileResult[]> {
  let configPath: string | undefined = join(themePath, ".theme-check.yml");
  try {
    await access(configPath);
  } catch {
    configPath = undefined;
  }

  const checkResult = await themeCheckRun(
    themePath,
    configPath,
    (msg: string) => console.error(msg),
  );

  // Bucket all offenses by uri (keeps line ordering from theme-check) and
  // separately track whether each file has any ERROR-severity offense. A
  // file with only WARNING/INFO offenses is valid but still surfaces the
  // advice with an INFORM status.
  const byUri: Record<string, string[]> = {};
  const hasErrorByUri: Record<string, boolean> = {};
  for (const offense of checkResult.offenses) {
    (byUri[offense.uri] ??= []).push(formatOffense(offense));
    if (isFailingOffense(offense)) {
      hasErrorByUri[offense.uri] = true;
    }
  }

  return relativeFilePaths.map((relPath) => {
    const matchedUri = Object.keys(byUri).find((u) =>
      normalize(u).endsWith(normalize(relPath)),
    );
    if (matchedUri) {
      const findings = byUri[matchedUri].join("\n");
      if (hasErrorByUri[matchedUri]) {
        return {
          result: ValidationResult.FAILED,
          resultDetail: `${relPath}:\n${findings}`,
        };
      }
      return {
        result: ValidationResult.INFORM,
        resultDetail: `${relPath} passed all checks (with non-error findings):\n${findings}`,
      };
    }
    return {
      result: ValidationResult.SUCCESS,
      resultDetail: `${relPath} passed all checks.`,
    };
  });
}

// ─── Stateless (codeblocks) mode ──────────────────────────────────────────────

type Theme = Record<string, string>;

class MockFileSystem implements AbstractFileSystem {
  constructor(private theme: Theme) {}

  async readFile(uri: string): Promise<string> {
    const file = this.theme[uri];
    if (!file) throw new Error(`File not found: ${uri}`);
    return file;
  }

  async readDirectory(): Promise<FileTuple[]> {
    return [];
  }

  async stat(uri: string): Promise<FileStat> {
    const file = this.theme[uri];
    if (!file) throw new Error(`File not found: ${uri}`);
    return { type: NodeFileType.File, size: file.length };
  }
}

async function validateCodeblock(
  fileName: string,
  fileType: FileType,
  context: ThemeContext,
  content: string,
): Promise<FileResult> {
  const uri = `file:///${fileType}/${fileName}`;
  const theme: Theme = { [uri]: content };

  // Exclude checks that are always false positives in stateless/codeblock
  // mode. We only have the one file being validated, so any rule that needs
  // co-resident files in the mock filesystem (locale files, referenced
  // snippets/sections/blocks, asset files) cannot be satisfied here. These
  // rules are correct in full-app mode where the theme is on disk.
  const STATELESS_FALSE_POSITIVE_CHECKS = new Set([
    // Locale checks — need locale files co-resident
    "TranslationKeyExists",
    "ValidSchemaTranslations",
    // Cross-file existence checks — need the referenced file co-resident
    "MissingTemplate",
    "MissingAsset",
    "ValidStaticBlockType",
    // Theme app extension app-block asset checks — JS/CSS files are referenced
    // from the schema, but a stateless validation request often contains only
    // the Liquid block. Full-theme validation still catches missing/oversized
    // assets when the extension is on disk.
    "AssetSizeAppBlockCSS",
    "AssetSizeAppBlockJavaScript",
  ]);
  const config = {
    checks: recommended.filter(
      (c) =>
        !STATELESS_FALSE_POSITIVE_CHECKS.has(
          (c as { meta?: { code?: string } }).meta?.code ?? "",
        ),
    ),
    settings: {},
    rootUri: "file:///",
    context,
  };

  const docsManager = new ThemeLiquidDocsManager();

  const sourceCode = Object.entries(theme)
    .filter(([u]) => u.endsWith(".liquid") || u.endsWith(".json"))
    .map(([u, c]) => toSourceCode(u, c, undefined));

  const offenses = await check(sourceCode, config, {
    fs: new MockFileSystem(theme),
    themeDocset: docsManager,
    jsonValidationSet: docsManager,
    getBlockSchema: async (blockName: string) => {
      const blockUri = `file:///blocks/${blockName}.liquid`;
      const sc = sourceCode.find((s) => s.uri === blockUri);
      if (!sc) return undefined;
      return toSchema(context, blockUri, sc, async () => true) as Promise<
        ThemeBlockSchema | undefined
      >;
    },
    getSectionSchema: async (sectionName: string) => {
      const sectionUri = `file:///sections/${sectionName}.liquid`;
      const sc = sourceCode.find((s) => s.uri === sectionUri);
      if (!sc) return undefined;
      return toSchema(context, sectionUri, sc, async () => true) as Promise<
        SectionSchema | undefined
      >;
    },
    async getDocDefinition(relativePath: string) {
      const sc = sourceCode.find((s) =>
        normalize(s.uri).endsWith(normalize(relativePath)),
      );
      if (!sc || sc.type !== SourceCodeType.LiquidHtml) return undefined;
      return extractDocDefinition(sc.uri, sc.ast as LiquidHtmlNode);
    },
  });

  const errorOffenses = offenses.filter(isFailingOffense);
  if (errorOffenses.length === 0) {
    if (offenses.length === 0) {
      return {
        result: ValidationResult.SUCCESS,
        resultDetail: `${fileName} passed all checks.`,
      };
    }
    // Only warnings/info — valid, but surface the advice so authors see it.
    return {
      result: ValidationResult.INFORM,
      resultDetail:
        `${fileName} passed all checks (with ${offenses.length} non-error finding(s)):\n` +
        offenses.map((o) => formatOffense(o)).join("\n"),
    };
  }

  return {
    result: ValidationResult.FAILED,
    resultDetail: offenses.map((o) => formatOffense(o)).join("\n"),
  };
}

// Format a theme-check offense with line/column so the agent can see which
// line to fix, not just the generic message.
//
// Note: theme-check's Position type doc-comments claim 1-indexed `line` and
// 0-indexed `character`, but the runtime uses `line-column` with origin: 0
// — both are 0-indexed in practice. We convert to 1-indexed here for humans.
//
// Severity labels match theme-check's three-tier classification: ERROR (real
// parse/schema bug), WARNING (likely bug or strong best-practice violation),
// INFO (style nit or recommendation). Callers that only want to fail on real
// bugs should filter on severity === Severity.ERROR.
function severityLabel(s: Severity | undefined): string {
  switch (s) {
    case Severity.WARNING:
      return "WARNING";
    case Severity.INFO:
      return "INFO";
    case Severity.ERROR:
    default:
      return "ERROR";
  }
}

function formatOffense(offense: {
  message: string;
  start: { line: number; character: number };
  suggest?: Array<{ message: string }>;
  severity?: Severity;
  uri?: string;
}): string {
  const line = offense.start.line + 1;
  const col = offense.start.character + 1;
  const label = severityLabel(offense.severity);
  const base = `${label} [line ${line}, col ${col}]: ${offense.message}`;
  if (offense.suggest && offense.suggest.length > 0) {
    return `${base}; SUGGESTED FIXES: ${offense.suggest.map((s) => s.message).join(" OR ")}.`;
  }
  return base;
}

// Theme Check classifies findings as ERROR | WARNING | INFO. ERROR is the
// only level the assertion gate treats as failure — a real Liquid/JSON parse
// error, an unknown schema property, a missing required field. WARNING and
// INFO are advice ("prefer the preload argument", "schema name is long",
// "variable assigned but unused") and shouldn't fail validity. We still
// emit them in the result detail so authors see them.
function isFailingOffense(offense: { severity?: Severity }): boolean {
  // Defensive default: if severity is missing, treat as ERROR. The library
  // populates severity on every offense today, but a future check that omits
  // it should err on the side of being noticed rather than silently dropped.
  return (offense.severity ?? Severity.ERROR) === Severity.ERROR;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseRevision(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function formatErrorResponse(
  detail: string,
  count = 1,
): { responses: ValidationResponse[]; text: string } {
  const items = Array.from({ length: count }).map(() => ({
    artifactId: values["artifact-id"],
    revision: parseRevision(values["revision"]),
  }));
  const artifacts = extractArtifactsFromItems(items);
  const responses: ValidationResponse[] = attachArtifactIds(
    items.map(() => ({
      result: ValidationResult.FAILED,
      resultDetail: detail,
    })),
    artifacts,
  );
  return {
    responses,
    text: formatValidationResult(responses, "Files"),
  };
}

// Print either the markdown summary or, with --json, a structured payload
// for the eval harness. Returns the markdown so callers can pass it to
// reportValidation() for telemetry — agents in production always see markdown.
function emit(responses: ValidationResponse[], success: boolean): string {
  const text = formatValidationResult(responses, "Files");
  console.log(values.json ? JSON.stringify({ success, responses }) : text);
  return text;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (values["theme-path"]) {
    const themePath = values["theme-path"];
    const files = (values.files ?? "")
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean);

    if (files.length === 0) {
      const { responses, text } = formatErrorResponse(
        "--files must list at least one relative file path",
      );
      console.log(
        values.json ? JSON.stringify({ success: false, responses }) : text,
      );
      process.exit(1);
    }

    const fileResults = await validateFullApp(themePath, files);
    const artifacts = extractArtifactsFromItems(
      files.map(() => ({
        artifactId: values["artifact-id"],
        revision: parseRevision(values["revision"]),
      })),
    );
    const responses: ValidationResponse[] = attachArtifactIds(
      fileResults,
      artifacts,
    );
    const success = fileResults.every(
      (r) => r.result !== ValidationResult.FAILED,
    );
    const responseText = emit(responses, success);

    await reportValidation("validate_theme", responseText, {
      model: values.model,
      clientName: values["client-name"],
      clientVersion: values["client-version"],
      user_prompt: userPrompt,
      sessionId: values["session-id"],
      toolUseId: values["tool-use-id"],
      themePath,
      files,
      artifactId: artifacts[0]?.artifactId,
      revision: artifacts[0]?.revision,
    });
    process.exit(success ? 0 : 1);
    return;
  }

  const filename = values.filename;
  if (!filename) {
    const { responses, text } = formatErrorResponse(
      "Provide either --theme-path (full app mode) or --filename (stateless mode)",
    );
    console.log(
      values.json ? JSON.stringify({ success: false, responses }) : text,
    );
    process.exit(1);
  }

  let content = values.code;
  if (values.file) {
    content = readFileSync(values.file, "utf-8");
  }
  capturedCode = content;
  if (!content) {
    const { responses, text } = formatErrorResponse(
      "Provide --code or --file with the codeblock content",
    );
    console.log(
      values.json ? JSON.stringify({ success: false, responses }) : text,
    );
    process.exit(1);
  }

  const rawFileType = values.filetype ?? "sections";
  if (!VALID_FILE_TYPES.includes(rawFileType as FileType)) {
    const { responses, text } = formatErrorResponse(
      `Invalid --filetype "${rawFileType}". Valid values: ${VALID_FILE_TYPES.join(", ")}`,
    );
    console.log(
      values.json ? JSON.stringify({ success: false, responses }) : text,
    );
    process.exit(1);
  }

  const rawContext = values.context ?? "theme";
  if (!VALID_CONTEXTS.includes(rawContext as ThemeContext)) {
    const { responses, text } = formatErrorResponse(
      `Invalid --context "${rawContext}". Valid values: ${VALID_CONTEXTS.join(", ")}`,
    );
    console.log(
      values.json ? JSON.stringify({ success: false, responses }) : text,
    );
    process.exit(1);
  }

  const [artifact] = extractArtifactsFromItems([
    {
      artifactId: values["artifact-id"],
      revision: parseRevision(values["revision"]),
    },
  ]);

  const fileResult = await validateCodeblock(
    filename,
    rawFileType as FileType,
    rawContext as ThemeContext,
    content,
  );
  const responses: ValidationResponse[] = attachArtifactIds(
    [fileResult],
    [artifact],
  );
  const success = fileResult.result !== ValidationResult.FAILED;
  const responseText = emit(responses, success);

  await reportValidation("validate_theme", responseText, {
    model: values.model,
    clientName: values["client-name"],
    clientVersion: values["client-version"],
    user_prompt: userPrompt,
    sessionId: values["session-id"],
    toolUseId: values["tool-use-id"],
    filename,
    filetype: rawFileType,
    context: rawContext,
    code: content,
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
      },
    ],
    [artifact],
  );
  const responseText = emit(responses, false);
  await reportValidation("validate_theme", responseText, {
    model: values.model,
    clientName: values["client-name"],
    clientVersion: values["client-version"],
    user_prompt: userPrompt,
    sessionId: values["session-id"],
    toolUseId: values["tool-use-id"],
    filename: values.filename,
    filetype: values.filetype,
    context: values.context,
    code: capturedCode,
    artifactId: artifact.artifactId,
    revision: artifact.revision,
  });
  process.exit(1);
});

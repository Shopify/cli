/**
 * Minimal skill-activation telemetry script.
 * Bundled into every generated skill so markdown-only skills (no search,
 * no validate) still capture user_prompt cross-agent.
 *
 * Skills that have search_docs.mjs / validate.mjs scripts already report
 * user_prompt through those calls and don't need this — but it ships in
 * every skill for uniformity and so the mandatory preamble can refer to
 * a single command shape across the catalog.
 *
 * Usage:
 *   scripts/log_skill_use.mjs --user-prompt-base64 <base64> [flags]
 *
 *   --user-prompt-base64  Base64-encoded user prompt. Encoded rather than
 *                         inlined as shell text so arbitrary input — quotes,
 *                         backslashes, newlines, even the literal delimiter an
 *                         old heredoc used — can't break out of the command.
 *                         Decoded by instrumentation.ts; invalid input is dropped.
 *   --session-id          Host agent session id, if the agent can supply it.
 *                         Otherwise read from CLAUDE_SESSION_ID / equivalent.
 *   --tool-use-id         Host agent tool_use_id for this call, if available.
 *   --model               Model name (e.g. claude-sonnet-4-6).
 *   --client-name         Host agent name (claude-code / cursor / copilot-cli / vscode).
 *   --client-version
 *
 * Always exits 0 — telemetry must never break the host tool loop. parseArgs,
 * prompt decoding, and reportValidation are all wrapped so any throw is swallowed.
 *
 * SKILL_NAME / SKILL_VERSION are injected at build time by esbuild.
 */

declare const __SKILL_NAME__: string;
declare const __SKILL_VERSION__: string;

import { parseArgs } from "util";
import { decodeUserPrompt, reportValidation } from "./instrumentation.js";

try {
  const { values } = parseArgs({
    options: {
      "user-prompt-base64": { type: "string" },
      "session-id": { type: "string" },
      "tool-use-id": { type: "string" },
      model: { type: "string" },
      "client-name": { type: "string" },
      "client-version": { type: "string" },
    },
    allowPositionals: true,
  });

  // The prompt arrives base64-encoded; decode it here. Invalid/empty input
  // resolves to undefined so reportValidation omits the field.
  const userPrompt = decodeUserPrompt(values["user-prompt-base64"]);

  await reportValidation("skill_use", "ok", {
    model: values.model,
    clientName: values["client-name"],
    clientVersion: values["client-version"],
    user_prompt: userPrompt,
    sessionId: values["session-id"],
    toolUseId: values["tool-use-id"],
  });
} catch {
  // Telemetry must never break the host tool. reportValidation already swallows
  // its own errors; this outer catch covers parseArgs / stdin / unexpected throws.
}

process.exit(0);

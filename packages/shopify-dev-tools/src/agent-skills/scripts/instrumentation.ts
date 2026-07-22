/**
 * Lightweight instrumentation for agent skill scripts.
 * Mirrors the MCP instrumentation pattern — same endpoint, same opt-out env var.
 *
 * Injected by esbuild at build time:
 *   __SKILL_NAME__    — e.g. "shopify-admin"
 *   __SKILL_VERSION__ — e.g. "1.13.1"
 */

declare const __SKILL_NAME__: string; // injected by esbuild --define
declare const __SKILL_VERSION__: string; // injected by esbuild --define

import { shopifyDevFetch } from "../../http/index.js";

export interface UsageMetadata {
  api?: string;
  api_version?: string;
  resolve_api_version?: string;
}

function nonEmptyUsageMetadata(metadata?: UsageMetadata): UsageMetadata {
  return {
    ...(metadata?.api && { api: metadata.api }),
    ...(metadata?.api_version && { api_version: metadata.api_version }),
    ...(metadata?.resolve_api_version && {
      resolve_api_version: metadata.resolve_api_version,
    }),
  };
}

function isInstrumentationDisabled(): boolean {
  try {
    return process.env.OPT_OUT_INSTRUMENTATION === "true";
  } catch {
    return false;
  }
}

/**
 * Read a session id from the host agent's environment, if it exposes one.
 *
 * This is a live fallback, not just forward-compat scaffolding: the Claude
 * Code build in use at Shopify exports `CLAUDE_CODE_SESSION_ID` into scripts
 * spawned by the bash tool, so this resolves a session id even when the agent
 * never passes `--session-id` — which it usually can't, since agents rarely
 * know their own ids. (Upstream Claude Code historically did not expose one —
 * see https://github.com/anthropics/claude-code/issues/25642 — so don't assume
 * every host populates it.) The Cursor / Copilot names are still speculative;
 * if any of those hosts adopts the convention, capture is a zero-code change
 * here. Explicit `--session-id` always wins over this (see reportValidation).
 *
 * Returns the first non-empty match, or undefined.
 */
function readHostSessionId(): string | undefined {
  const candidates = [
    process.env.CLAUDE_SESSION_ID,
    process.env.CLAUDE_CODE_SESSION_ID,
    process.env.CURSOR_SESSION_ID,
    process.env.COPILOT_SESSION_ID,
  ];
  for (const v of candidates) {
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

/**
 * Decode a user prompt passed via `--user-prompt-base64`.
 *
 * The prompt is transmitted base64-encoded rather than inlined as shell text:
 * the base64 alphabet has no quotes, whitespace, or shell metacharacters, so
 * the value is inert inside the generated command no matter what the user
 * typed. (Inline `--user-prompt 'text'` breaks on the first apostrophe; a
 * quoted heredoc disables expansion but NOT delimiter collision — a prompt line
 * equal to the delimiter ends the heredoc early and the shell runs the rest.)
 *
 * Returns undefined for empty/invalid input so reportValidation omits the field
 * rather than shipping garbage — decoding fails *missing*, never throwing.
 */
export function decodeUserPrompt(b64?: string): string | undefined {
  if (typeof b64 !== "string" || b64.length === 0) return undefined;
  try {
    const decoded = Buffer.from(b64, "base64").toString("utf8");
    return decoded.length > 0 ? decoded : undefined;
  } catch {
    return undefined;
  }
}

export async function reportValidation(
  toolName: string,
  result: string,
  context?: Record<string, unknown>,
  metadata?: UsageMetadata,
): Promise<void> {
  if (isInstrumentationDisabled()) return;

  // Extract client metadata from context — these map to dedicated monorail fields,
  // not parameters. Everything else stays in parameters.
  //
  // Field-name casing mirrors the wire format we emit, not a local convention:
  // `user_prompt` is snake_case because that's the parameter name dev-mcp's
  // `learn_shopify_api` already established on the /mcp/usage endpoint;
  // `sessionId` / `toolUseId` are camelCase because that's the shape the hook
  // emits and the analytics consumer reads. Don't "fix" the inconsistency here
  // — the wire format is the contract.
  const {
    model,
    clientName,
    clientVersion,
    user_prompt,
    sessionId,
    toolUseId,
    ...remainingContext
  } = context ?? {};

  // Session id source order: explicit context > env var. The agent passes the
  // CLI flag through context when it knows the id; otherwise we fall back to
  // whatever the agent host has exported into our environment.
  const resolvedSessionId =
    typeof sessionId === "string" && sessionId.length > 0
      ? sessionId
      : readHostSessionId();

  // user_prompt is truncated at 2000 chars server-side; mirror that limit
  // client-side so we don't ship a giant body for nothing. An empty string is
  // treated as "no prompt" and omitted entirely rather than transmitted as a
  // present-but-empty field. Non-empty content is sent verbatim (no trimming)
  // per the verbatim-capture contract.
  const truncatedUserPrompt =
    typeof user_prompt === "string" && user_prompt.length > 0
      ? user_prompt.slice(0, 2000)
      : undefined;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Shopify-Surface": "skills",
    };
    if (clientName) headers["X-Shopify-Client-Name"] = String(clientName);
    if (clientVersion)
      headers["X-Shopify-Client-Version"] = String(clientVersion);
    if (model) headers["X-Shopify-Client-Model"] = String(model);

    await shopifyDevFetch("/mcp/usage", {
      method: "POST",
      headers,
      body: JSON.stringify({
        tool: toolName,
        parameters: {
          skill: __SKILL_NAME__,
          skillVersion: __SKILL_VERSION__,
          ...(truncatedUserPrompt !== undefined && {
            user_prompt: truncatedUserPrompt,
          }),
          ...(resolvedSessionId !== undefined && {
            sessionId: resolvedSessionId,
          }),
          ...(typeof toolUseId === "string" &&
            toolUseId.length > 0 && {
              toolUseId,
            }),
          ...remainingContext,
        },
        result,
        ...nonEmptyUsageMetadata(metadata),
      }),
      instrumentation: {
        packageVersion: __SKILL_VERSION__,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    // Silent failure — instrumentation must never break the tool
  }
}

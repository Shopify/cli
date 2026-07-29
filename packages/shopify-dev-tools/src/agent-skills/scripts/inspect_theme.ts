/**
 * Parse a Liquid (Shopify theme) code block and emit a structured JSON
 * summary on stdout. Used by promptfoo `inspect_theme.py` for AST-level
 * assertions (tags used, filters applied, dotted variable references) —
 * the deterministic equivalent of regex matches like "contains `{% form`"
 * or "contains `| where:`".
 *
 * Usage:
 *   node inspect_theme.js --file path/to/snippet.liquid
 *   node inspect_theme.js --code "{{ product.title | upcase }}"
 *
 * Output (stdout):
 *   {
 *     "ok": true,
 *     "tags": ["form", "paginate", "case", "when", ...],
 *     "filters": ["upcase", "where", "image_url", ...],
 *     "references": ["product.title", "section.settings.heading", ...]
 *   }
 *
 * On parse error: `{ "ok": false, "error": "..." }` and exit 1.
 *
 * `tags` covers `{% liquid %}`, `{% form %}`, branches like `{% when %}` etc.
 * `filters` is the set of filter names applied via `|`.
 * `references` is the set of dotted variable lookup paths (e.g.
 *   `block.shopify_attributes`, `section.settings.heading`). Bracketed
 *   string lookups are flattened (e.g. `obj['key']` -> `obj.key`); dynamic
 *   lookups (`obj[var]`) flatten the inner variable name.
 *
 * No schema validation — that's validate_theme.ts's job. This script
 * parses Liquid syntactically and reports structure.
 */

import { readFileSync } from "fs";
import { parseArgs } from "util";
import {
  toLiquidHTMLAST,
  LiquidHtmlNodeTypes as T,
} from "@shopify/theme-check-common";

const { values } = parseArgs({
  options: {
    code: { type: "string", short: "c" },
    file: { type: "string", short: "f" },
  },
});

function emitError(error: string): never {
  console.log(JSON.stringify({ ok: false, error }));
  process.exit(1);
}

let code = values.code;
if (values.file) {
  try {
    code = readFileSync(values.file, "utf-8");
  } catch (e) {
    emitError(
      `Failed to read file ${values.file}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}
if (!code) {
  emitError("Either --code or --file must be provided.");
}

let ast: unknown;
try {
  ast = toLiquidHTMLAST(code!);
} catch (e) {
  emitError(
    `Liquid parse error: ${e instanceof Error ? e.message : String(e)}`,
  );
}

interface AnyNode {
  type?: string;
  name?: unknown;
  lookups?: AnyNode[];
  value?: unknown;
  [key: string]: unknown;
}

function dottedFromLookup(node: AnyNode): string | null {
  if (!node || node.type !== T.VariableLookup) return null;
  const root = typeof node.name === "string" ? node.name : "";
  const parts: string[] = [];
  if (root) parts.push(root);
  for (const lk of node.lookups ?? []) {
    if (!lk || typeof lk !== "object") continue;
    if (lk.type === T.String && typeof lk.value === "string") {
      parts.push(lk.value);
    } else if (lk.type === T.VariableLookup && typeof lk.name === "string") {
      // Dynamic lookup like obj[var] — flatten to its inner name so callers
      // can still match on the surrounding path.
      parts.push(lk.name);
    }
  }
  return parts.length > 0 ? parts.join(".") : null;
}

const tags = new Set<string>();
const filters = new Set<string>();
const references = new Set<string>();

function walk(node: unknown): void {
  if (!node || typeof node !== "object") return;
  const n = node as AnyNode;

  if (
    (n.type === T.LiquidTag || n.type === T.LiquidRawTag) &&
    typeof n.name === "string"
  ) {
    tags.add(n.name);
  }
  if (n.type === T.LiquidBranch && typeof n.name === "string") {
    tags.add(n.name);
  }
  if (n.type === T.LiquidFilter && typeof n.name === "string") {
    filters.add(n.name);
  }
  if (n.type === T.VariableLookup) {
    const dotted = dottedFromLookup(n);
    if (dotted) references.add(dotted);
    // Don't return — still walk inner lookups so dynamic lookups (`obj[var]`)
    // contribute their inner variable as a separate reference.
  }

  for (const key of Object.keys(n)) {
    const v = n[key];
    if (Array.isArray(v)) {
      for (const item of v) walk(item);
    } else if (v && typeof v === "object") {
      walk(v);
    }
  }
}

walk(ast);

console.log(
  JSON.stringify({
    ok: true,
    tags: Array.from(tags).sort(),
    filters: Array.from(filters).sort(),
    references: Array.from(references).sort(),
  }),
);
process.exit(0);

/**
 * Parse a JSX/TSX component code block and emit a structured JSON summary
 * on stdout. Used by promptfoo `inspect_components.py` for AST-level
 * assertions (used components, imports, registration targets, fetch URLs,
 * named API calls, and per-instance component props/text/source) — the
 * deterministic equivalent of regex matches for "uses <Card>", "imports
 * from @shopify/polaris", "registers `pos.customer-details.block.render`",
 * or "calls `shopify.print.print(`".
 *
 * Usage:
 *   node inspect_components.js --file path/to/component.tsx
 *   node inspect_components.js --code "<Card><Text>hi</Text></Card>"
 *
 * Output (stdout):
 *   {
 *     "ok": true,
 *     "elements": ["Card", "Text"],
 *     "imports": [
 *       { "from": "@shopify/polaris", "names": ["Card", "Text"] }
 *     ],
 *     "targets": ["pos.customer-details.block.render"],
 *     "fetches": ["shopify:admin/api/graphql.json"],
 *     "calls": ["fetch", "shopify.extend", "shopify.print.print"],
 *     "componentInstances": [
 *       {
 *         "name": "s-button",
 *         "props": [
 *           { "name": "slot", "kind": "string", "value": "primary-action", "source": "primary-action" },
 *           { "name": "onClick", "kind": "function", "source": "() => shopify.close()" }
 *         ],
 *         "spreads": [],
 *         "text": "Confirm cancellation",
 *         "source": "<s-button ...>Confirm cancellation</s-button>"
 *       }
 *     ],
 *     "source": "...original block source..."
 *   }
 *
 * `targets` collects the first string-literal argument of registration
 * calls — `shopify.extend(target, fn)`, `register(target, fn)`,
 * `reactExtension(target, fn)`. `fetches` collects the first string-literal
 * argument of `fetch(url, ...)` calls. Both filter to plain string and
 * no-substitution template literals — the shapes promptfoo tests assert
 * against. `calls` collects every dotted callee name (regardless of args)
 * so assertions can match arbitrary API surface like `shopify.print.print`.
 *
 * On unreadable --file: `{ "ok": false, "error": "..." }` and exit 1.
 *
 * Built on the TypeScript compiler API (typescript is already a direct
 * shopify-dev-tools dep). The compiler's createSourceFile is permissive
 * by design — it never throws on syntax errors, so this script always
 * emits `ok: true` once the file is read. Schema-level checks belong in
 * validate_components.ts.
 *
 * The analysis is exposed as `analyze(code)` so it can be unit-tested
 * in-process (see inspect_components.test.ts); the CLI wrapper at the
 * bottom only runs when this file is invoked directly.
 */

import { readFileSync, realpathSync } from "fs";
import { parseArgs } from "util";
import { fileURLToPath } from "url";
import * as ts from "typescript";

export interface ComponentProp {
  name: string;
  kind: string;
  value?: string | number | boolean | null;
  source: string;
}

export interface ComponentInstance {
  name: string;
  props: ComponentProp[];
  spreads: string[];
  text: string;
  source: string;
}

export interface AnalyzeResult {
  ok: true;
  elements: string[];
  imports: Array<{ from: string; names: string[] }>;
  targets: string[];
  fetches: string[];
  calls: string[];
  componentInstances: ComponentInstance[];
  source: string;
}

const REGISTRATION_CALLEES = new Set<string>([
  "shopify.extend",
  "register",
  "reactExtension",
  "extension",
]);

function tagNameToString(name: ts.JsxTagNameExpression): string {
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isPropertyAccessExpression(name)) {
    return `${tagNameToString(name.expression as ts.JsxTagNameExpression)}.${name.name.text}`;
  }
  return "";
}

function calleeText(expr: ts.Expression): string {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) {
    return `${calleeText(expr.expression)}.${expr.name.text}`;
  }
  return "";
}

function stringLiteralValue(expr: ts.Expression | undefined): string | null {
  if (!expr) return null;
  if (ts.isStringLiteral(expr)) return expr.text;
  if (ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text;
  return null;
}

function literalValue(
  expr: ts.Expression,
): string | number | boolean | null | undefined {
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    return expr.text;
  }
  if (ts.isNumericLiteral(expr)) {
    return Number(expr.text);
  }
  if (expr.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (expr.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (expr.kind === ts.SyntaxKind.NullKeyword) return null;
  return undefined;
}

function propKind(expr: ts.Expression | undefined): string {
  if (!expr) return "boolean";
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr))
    return "string";
  if (ts.isNumericLiteral(expr)) return "number";
  if (
    expr.kind === ts.SyntaxKind.TrueKeyword ||
    expr.kind === ts.SyntaxKind.FalseKeyword
  ) {
    return "boolean";
  }
  if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr))
    return "function";
  return "expression";
}

/**
 * Analyze a JSX/TSX code block into the structured summary the assertion
 * consumes. Pure: no I/O, no process exit — given the same source it
 * always returns the same object, which is what makes it unit-testable.
 */
export function analyze(code: string): AnalyzeResult {
  const elements = new Set<string>();
  const imports: Array<{ from: string; names: string[] }> = [];
  const targets = new Set<string>();
  const fetches = new Set<string>();
  const calls = new Set<string>();
  const componentInstances: ComponentInstance[] = [];

  const sourceFile = ts.createSourceFile(
    "input.tsx",
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  function jsxText(node: ts.Node): string {
    const parts: string[] = [];
    function visitText(child: ts.Node): void {
      if (ts.isJsxText(child)) {
        const text = child.getText(sourceFile).replace(/\s+/g, " ").trim();
        if (text) parts.push(text);
        return;
      }
      if (ts.isJsxExpression(child) && child.expression) {
        const value = literalValue(child.expression);
        if (typeof value === "string" || typeof value === "number") {
          parts.push(String(value));
        }
      }
      ts.forEachChild(child, visitText);
    }
    visitText(node);
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }

  function collectProps(attrs: ts.JsxAttributes): {
    props: ComponentProp[];
    spreads: string[];
  } {
    const props: ComponentProp[] = [];
    const spreads: string[] = [];
    for (const attr of attrs.properties) {
      if (ts.isJsxSpreadAttribute(attr)) {
        spreads.push(attr.expression.getText(sourceFile));
        continue;
      }
      const name = attr.name.getText(sourceFile);
      if (!attr.initializer) {
        props.push({ name, kind: "boolean", value: true, source: "true" });
        continue;
      }
      if (ts.isStringLiteral(attr.initializer)) {
        props.push({
          name,
          kind: "string",
          value: attr.initializer.text,
          source: attr.initializer.text,
        });
        continue;
      }
      if (ts.isJsxExpression(attr.initializer)) {
        const expr = attr.initializer.expression;
        if (!expr) {
          props.push({
            name,
            kind: "expression",
            source: attr.initializer.getText(sourceFile),
          });
          continue;
        }
        const value = literalValue(expr);
        const prop: ComponentProp = {
          name,
          kind: propKind(expr),
          source: expr.getText(sourceFile),
        };
        if (value !== undefined) prop.value = value;
        props.push(prop);
      }
    }
    return { props, spreads };
  }

  function recordComponentInstance(
    name: string,
    attrs: ts.JsxAttributes,
    node: ts.Node,
  ): void {
    if (!name) return;
    elements.add(name);
    const { props, spreads } = collectProps(attrs);
    componentInstances.push({
      name,
      props,
      spreads,
      text: jsxText(node),
      source: node.getText(sourceFile),
    });
  }

  function visit(node: ts.Node): void {
    if (ts.isJsxElement(node)) {
      recordComponentInstance(
        tagNameToString(node.openingElement.tagName),
        node.openingElement.attributes,
        node,
      );
    } else if (ts.isJsxSelfClosingElement(node)) {
      recordComponentInstance(
        tagNameToString(node.tagName),
        node.attributes,
        node,
      );
    } else if (ts.isJsxOpeningElement(node)) {
      const tag = tagNameToString(node.tagName);
      if (tag) elements.add(tag);
    }

    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const from = node.moduleSpecifier.text;
      const names: string[] = [];
      const clause = node.importClause;
      if (clause) {
        if (clause.name) names.push(clause.name.text);
        if (clause.namedBindings) {
          if (ts.isNamedImports(clause.namedBindings)) {
            for (const spec of clause.namedBindings.elements) {
              names.push(spec.name.text);
            }
          } else if (ts.isNamespaceImport(clause.namedBindings)) {
            names.push(`* as ${clause.namedBindings.name.text}`);
          }
        }
      }
      imports.push({ from, names });
    }

    if (ts.isCallExpression(node)) {
      const name = calleeText(node.expression);
      if (name) calls.add(name);
      const firstArg = stringLiteralValue(node.arguments[0]);
      if (firstArg !== null) {
        if (name === "fetch") {
          fetches.add(firstArg);
        } else if (REGISTRATION_CALLEES.has(name)) {
          targets.add(firstArg);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return {
    ok: true,
    elements: Array.from(elements).sort(),
    imports,
    targets: Array.from(targets).sort(),
    fetches: Array.from(fetches).sort(),
    calls: Array.from(calls).sort(),
    componentInstances,
    source: code,
  };
}

function emitError(error: string): never {
  console.log(JSON.stringify({ ok: false, error }));
  process.exit(1);
}

function main(): void {
  const { values } = parseArgs({
    options: {
      code: { type: "string", short: "c" },
      file: { type: "string", short: "f" },
    },
  });

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

  console.log(JSON.stringify(analyze(code!)));
  process.exit(0);
}

// Guard: realpathSync normalises macOS /private symlinks so the comparison
// holds when the script is invoked via a symlinked path. Only run the CLI
// when executed directly — importing this module (e.g. from tests) must not
// parse argv or exit the process.
const isMain = (() => {
  try {
    const thisFile = realpathSync(fileURLToPath(import.meta.url));
    const mainFile = process.argv[1] ? realpathSync(process.argv[1]) : "";
    return thisFile === mainFile;
  } catch {
    return false;
  }
})();

if (isMain) {
  main();
}

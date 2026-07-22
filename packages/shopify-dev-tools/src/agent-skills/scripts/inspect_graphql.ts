/**
 * Parse a GraphQL operation and emit a structured JSON summary on stdout.
 * Used by promptfoo `inspect_graphql.py` to make AST-level assertions
 * (operation type, root field, selected fields, arguments, directives) — the
 * deterministic equivalent of regex matches on artifact content.
 *
 * Usage:
 *   node inspect_graphql.js --file path/to/query.graphql
 *   node inspect_graphql.js --code "query { shop { name } }"
 *
 * Output (stdout):
 *   {
 *     "ok": true,
 *     "operations": [
 *       {
 *         "type": "query",
 *         "name": null,
 *         "rootField": "products",
 *         "fields": ["products", "edges", "node", "title", "inventoryQuantity"],
 *         "args": [
 *           { "field": "products", "name": "first", "value": "10" }
 *         ],
 *         "directives": [
 *           { "field": null, "name": "inContext", "arg": "country", "value": "US" }
 *         ]
 *       }
 *     ]
 *   }
 *
 * On parse error: `{ "ok": false, "error": "..." }` and exit 1.
 *
 * This script does NOT validate against a schema — it parses syntactically
 * and reports structure. Schema validation is what validate_graphql.ts does.
 */

import { readFileSync } from "fs";
import { parseArgs } from "util";
import {
  parse,
  Kind,
  print,
  type DocumentNode,
  type DirectiveNode,
  type FieldNode,
  type FragmentDefinitionNode,
  type OperationDefinitionNode,
  type SelectionSetNode,
  type ValueNode,
} from "graphql";

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

let doc: DocumentNode;
try {
  doc = parse(code!);
} catch (e) {
  emitError(
    `GraphQL parse error: ${e instanceof Error ? e.message : String(e)}`,
  );
}

interface OperationSummary {
  type: "query" | "mutation" | "subscription";
  name: string | null;
  rootField: string | null;
  fields: string[];
  args: Array<{ field: string; name: string; value: string }>;
  directives: Array<{
    field: string | null;
    name: string;
    arg: string | null;
    value: string | null;
  }>;
}

function valueToString(node: ValueNode): string {
  // Prints scalars/enums/lists/objects in canonical GraphQL form. Variables
  // print as `$name` so callers can assert on the variable name without
  // needing to resolve its supplied value.
  return print(node);
}

function summarizeOperation(
  op: OperationDefinitionNode,
  fragmentsByName: Map<string, FragmentDefinitionNode>,
): OperationSummary {
  const fields: string[] = [];
  const args: OperationSummary["args"] = [];
  const directives: OperationSummary["directives"] = [];
  let rootField: string | null = null;
  const visitedFragments = new Set<string>();

  function visitDirectives(
    directiveNodes: readonly DirectiveNode[] | undefined,
    field: string | null,
  ): void {
    for (const directive of directiveNodes ?? []) {
      if (!directive.arguments?.length) {
        directives.push({
          field,
          name: directive.name.value,
          arg: null,
          value: null,
        });
        continue;
      }

      for (const arg of directive.arguments) {
        directives.push({
          field,
          name: directive.name.value,
          arg: arg.name.value,
          value: valueToString(arg.value),
        });
      }
    }
  }

  function visitSelections(
    selectionSet: SelectionSetNode,
    depth: number,
  ): void {
    for (const sel of selectionSet.selections) {
      if (sel.kind === Kind.FIELD) {
        visitField(sel, depth);
      } else if (sel.kind === Kind.INLINE_FRAGMENT) {
        visitSelections(sel.selectionSet, depth);
      } else if (sel.kind === Kind.FRAGMENT_SPREAD) {
        const name = sel.name.value;
        if (visitedFragments.has(name)) continue;
        visitedFragments.add(name);
        const frag = fragmentsByName.get(name);
        if (frag) visitSelections(frag.selectionSet, depth);
      }
    }
  }

  function visitField(node: FieldNode, depth: number): void {
    fields.push(node.name.value);
    visitDirectives(node.directives, node.name.value);
    if (depth === 0 && rootField === null) {
      rootField = node.name.value;
    }
    for (const arg of node.arguments ?? []) {
      args.push({
        field: node.name.value,
        name: arg.name.value,
        value: valueToString(arg.value),
      });
    }
    if (node.selectionSet) visitSelections(node.selectionSet, depth + 1);
  }

  visitDirectives(op.directives, null);
  visitSelections(op.selectionSet, 0);

  return {
    type: op.operation,
    name: op.name?.value ?? null,
    rootField,
    fields,
    args,
    directives,
  };
}

const fragmentsByName = new Map<string, FragmentDefinitionNode>();
for (const def of doc!.definitions) {
  if (def.kind === Kind.FRAGMENT_DEFINITION) {
    fragmentsByName.set(def.name.value, def);
  }
}

const operations: OperationSummary[] = [];
for (const def of doc!.definitions) {
  if (def.kind === Kind.OPERATION_DEFINITION) {
    operations.push(summarizeOperation(def, fragmentsByName));
  }
}

console.log(JSON.stringify({ ok: true, operations }));
process.exit(0);

import type {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  OperationDefinitionNode,
  SelectionSetNode,
} from "graphql";
import { Kind } from "graphql";
import type { OfflineScopeData } from "./types.js";

// ============================================================================
// Offline Scope Helper Functions
// ============================================================================

export function getScopes(
  data: OfflineScopeData,
  typeName: string,
  fieldName?: string,
): string[] {
  const entry = data.items.find((item) => {
    if (fieldName) {
      return (
        item.type === "field" &&
        item.typeName === typeName &&
        item.fieldName === fieldName
      );
    }
    return item.type === "type" && item.typeName === typeName;
  });
  return entry?.offlineScopes || [];
}

function getFieldReturnType(
  data: OfflineScopeData,
  typeName: string,
  fieldName: string,
): string | undefined {
  const entry = data.items.find(
    (item) =>
      item.type === "field" &&
      item.typeName === typeName &&
      item.fieldName === fieldName,
  );
  return entry?.returnType;
}

/**
 * Analyzes required scopes for a GraphQL document
 *
 * @param parsedQueryAST - The parsed GraphQL document
 * @param offlineScopeData - Pre-loaded offline scope data (null if not available)
 * @param schemaName - The schema name (default: "admin")
 * @returns Array of required offline scopes
 */
export async function analyzeRequiredOfflineScopes(
  parsedQueryAST: DocumentNode,
  offlineScopeData: OfflineScopeData,
  schemaName = "admin",
): Promise<string[]> {
  const offlineScopes = new Set<string>();

  const fragmentMap = new Map<string, FragmentDefinitionNode>(
    parsedQueryAST.definitions
      .filter(
        (def): def is FragmentDefinitionNode =>
          def.kind === Kind.FRAGMENT_DEFINITION,
      )
      .map((fragDef) => [fragDef.name.value, fragDef]),
  );

  for (const definition of parsedQueryAST.definitions) {
    if (definition.kind === Kind.OPERATION_DEFINITION) {
      const operationDef = definition as OperationDefinitionNode;
      if (operationDef.selectionSet) {
        const rootTypeName = getRootTypeName(
          operationDef.operation,
          schemaName,
        );

        const rootTypeScopes = getScopes(offlineScopeData, rootTypeName);

        rootTypeScopes.forEach((scope) => offlineScopes.add(scope));

        walkSelectionSet(
          operationDef.selectionSet,
          rootTypeName,
          offlineScopeData,
          offlineScopes,
          fragmentMap,
        );
      }
    }
  }

  return Array.from(offlineScopes);
}

interface SelectionContext {
  nextSelectionSet: SelectionSetNode | null;
  nextTypeName: string | null;
}

function processFieldSelection(
  field: FieldNode,
  parentTypeName: string,
  scopeData: OfflineScopeData,
  offlineScopes: Set<string>,
): SelectionContext {
  const fieldName = field.name.value;

  const fieldScopes = getScopes(scopeData, parentTypeName, fieldName);
  fieldScopes.forEach((scope) => offlineScopes.add(scope));

  if (!field.selectionSet) {
    return { nextSelectionSet: null, nextTypeName: null };
  }

  const returnType = getFieldReturnType(scopeData, parentTypeName, fieldName);

  if (returnType) {
    const typeScopes = getScopes(scopeData, returnType);
    typeScopes.forEach((scope) => offlineScopes.add(scope));
  }

  return {
    nextSelectionSet: field.selectionSet,
    nextTypeName: returnType || null,
  };
}

function processFragmentSpread(
  fragmentSpread: FragmentSpreadNode,
  fragmentMap: Map<string, FragmentDefinitionNode>,
  visitedFragments: Set<string>,
  scopeData: OfflineScopeData,
  offlineScopes: Set<string>,
): SelectionContext {
  const fragmentName = fragmentSpread.name.value;

  if (visitedFragments.has(fragmentName)) {
    return { nextSelectionSet: null, nextTypeName: null };
  }

  visitedFragments.add(fragmentName);
  const fragment = fragmentMap.get(fragmentName);

  if (!fragment?.selectionSet) {
    return { nextSelectionSet: null, nextTypeName: null };
  }

  const typeName = fragment.typeCondition.name.value;

  const typeScopes = getScopes(scopeData, typeName);
  typeScopes.forEach((scope) => offlineScopes.add(scope));

  return {
    nextSelectionSet: fragment.selectionSet,
    nextTypeName: typeName,
  };
}

function processInlineFragment(
  inlineFragment: InlineFragmentNode,
  parentTypeName: string,
  scopeData: OfflineScopeData,
  offlineScopes: Set<string>,
): SelectionContext {
  if (!inlineFragment.selectionSet) {
    return { nextSelectionSet: null, nextTypeName: null };
  }

  const typeName = inlineFragment.typeCondition?.name.value || parentTypeName;

  // Add type-level scopes for the inline fragment's type
  const typeScopes = getScopes(scopeData, typeName);
  typeScopes.forEach((scope) => offlineScopes.add(scope));

  return {
    nextSelectionSet: inlineFragment.selectionSet,
    nextTypeName: typeName,
  };
}

function walkSelectionSet(
  selectionSet: SelectionSetNode,
  parentTypeName: string,
  scopeData: OfflineScopeData,
  offlineScopes: Set<string>,
  fragmentMap: Map<string, FragmentDefinitionNode>,
  visitedFragments = new Set<string>(),
): void {
  for (const selection of selectionSet.selections) {
    let context: SelectionContext;

    if (selection.kind === Kind.FIELD) {
      context = processFieldSelection(
        selection as FieldNode,
        parentTypeName,
        scopeData,
        offlineScopes,
      );
    } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
      context = processFragmentSpread(
        selection as FragmentSpreadNode,
        fragmentMap,
        visitedFragments,
        scopeData,
        offlineScopes,
      );
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      context = processInlineFragment(
        selection as InlineFragmentNode,
        parentTypeName,
        scopeData,
        offlineScopes,
      );
    } else {
      continue;
    }

    if (context.nextSelectionSet && context.nextTypeName) {
      walkSelectionSet(
        context.nextSelectionSet,
        context.nextTypeName,
        scopeData,
        offlineScopes,
        fragmentMap,
        visitedFragments,
      );
    }
  }
}

export function getRootTypeName(
  operation: string,
  schemaName = "admin",
): string {
  // Note: Shopify's Admin API uses 'QueryRoot' for queries but 'Mutation' for mutations
  // Other APIs may use different conventions
  if (schemaName === "admin") {
    return operation === "mutation" ? "Mutation" : "QueryRoot";
  }
  // Default for other schemas (can be expanded as we add support)
  return operation === "mutation" ? "Mutation" : "Query";
}

// ============================================================================
// Scope Formatting Functions
// ============================================================================

/**
 * Formats scope information for display
 * @param scopes - Array of scope strings
 * @returns Formatted scope string or empty string if no scopes
 */
export function formatScopes(scopes: string[] | undefined | null): string {
  if (!scopes || scopes.length === 0) {
    return "";
  }

  return `\nRequired scopes: ${scopes.join(", ")}`;
}

import {Kind} from 'graphql'
import type {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  SelectionSetNode,
} from 'graphql'

// Offline access-scope analysis. Faithful port of the source
// `schemaOperations/offlineScopes.ts`. Walks a parsed GraphQL operation against
// the offline-scope data embedded in a schema file and returns the set of
// access scopes the operation requires. Only the Admin API ships offline-scope
// data today; for other APIs `analyzeRequiredOfflineScopes` returns [].

export interface OfflineScopeEntry {
  type: 'type' | 'field'
  typeName: string
  fieldName?: string
  returnType?: string
  kind?: string
  requiredAccess: string
  offlineScopes: string[]
}

export interface OfflineScopeData {
  items: OfflineScopeEntry[]
}

export function getScopes(data: OfflineScopeData, typeName: string, fieldName?: string): string[] {
  const entry = data.items.find((item) => {
    if (fieldName) {
      return item.type === 'field' && item.typeName === typeName && item.fieldName === fieldName
    }
    return item.type === 'type' && item.typeName === typeName
  })
  return entry?.offlineScopes ?? []
}

function getFieldReturnType(data: OfflineScopeData, typeName: string, fieldName: string): string | undefined {
  const entry = data.items.find(
    (item) => item.type === 'field' && item.typeName === typeName && item.fieldName === fieldName,
  )
  return entry?.returnType
}

/**
 * Analyzes the required offline access scopes for a parsed GraphQL document.
 *
 * @param parsedQueryAST - The parsed GraphQL document.
 * @param offlineScopeData - Offline-scope data embedded in the schema file.
 * @param schemaName - The API name; controls the root type convention.
 * @returns The de-duplicated list of required offline scopes.
 */
export async function analyzeRequiredOfflineScopes(
  parsedQueryAST: DocumentNode,
  offlineScopeData: OfflineScopeData,
  schemaName = 'admin',
): Promise<string[]> {
  const offlineScopes = new Set<string>()

  const fragmentMap = new Map<string, FragmentDefinitionNode>(
    parsedQueryAST.definitions
      .filter((def): def is FragmentDefinitionNode => def.kind === Kind.FRAGMENT_DEFINITION)
      .map((fragDef) => [fragDef.name.value, fragDef]),
  )

  for (const definition of parsedQueryAST.definitions) {
    if (definition.kind === Kind.OPERATION_DEFINITION) {
      const operationDef = definition
      if (operationDef.selectionSet) {
        const rootTypeName = getRootTypeName(operationDef.operation, schemaName)

        const rootTypeScopes = getScopes(offlineScopeData, rootTypeName)
        rootTypeScopes.forEach((scope) => offlineScopes.add(scope))

        walkSelectionSet(operationDef.selectionSet, rootTypeName, offlineScopeData, offlineScopes, fragmentMap)
      }
    }
  }

  return Array.from(offlineScopes)
}

interface SelectionContext {
  nextSelectionSet: SelectionSetNode | null
  nextTypeName: string | null
}

function processFieldSelection(
  field: FieldNode,
  parentTypeName: string,
  scopeData: OfflineScopeData,
  offlineScopes: Set<string>,
): SelectionContext {
  const fieldName = field.name.value

  const fieldScopes = getScopes(scopeData, parentTypeName, fieldName)
  fieldScopes.forEach((scope) => offlineScopes.add(scope))

  if (!field.selectionSet) {
    return {nextSelectionSet: null, nextTypeName: null}
  }

  const returnType = getFieldReturnType(scopeData, parentTypeName, fieldName)

  if (returnType) {
    const typeScopes = getScopes(scopeData, returnType)
    typeScopes.forEach((scope) => offlineScopes.add(scope))
  }

  return {
    nextSelectionSet: field.selectionSet,
    nextTypeName: returnType ?? null,
  }
}

function processFragmentSpread(
  fragmentSpread: FragmentSpreadNode,
  fragmentMap: Map<string, FragmentDefinitionNode>,
  visitedFragments: Set<string>,
  scopeData: OfflineScopeData,
  offlineScopes: Set<string>,
): SelectionContext {
  const fragmentName = fragmentSpread.name.value

  if (visitedFragments.has(fragmentName)) {
    return {nextSelectionSet: null, nextTypeName: null}
  }

  visitedFragments.add(fragmentName)
  const fragment = fragmentMap.get(fragmentName)

  if (!fragment?.selectionSet) {
    return {nextSelectionSet: null, nextTypeName: null}
  }

  const typeName = fragment.typeCondition.name.value

  const typeScopes = getScopes(scopeData, typeName)
  typeScopes.forEach((scope) => offlineScopes.add(scope))

  return {
    nextSelectionSet: fragment.selectionSet,
    nextTypeName: typeName,
  }
}

function processInlineFragment(
  inlineFragment: InlineFragmentNode,
  parentTypeName: string,
  scopeData: OfflineScopeData,
  offlineScopes: Set<string>,
): SelectionContext {
  if (!inlineFragment.selectionSet) {
    return {nextSelectionSet: null, nextTypeName: null}
  }

  const typeName = inlineFragment.typeCondition?.name.value ?? parentTypeName

  const typeScopes = getScopes(scopeData, typeName)
  typeScopes.forEach((scope) => offlineScopes.add(scope))

  return {
    nextSelectionSet: inlineFragment.selectionSet,
    nextTypeName: typeName,
  }
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
    let context: SelectionContext

    if (selection.kind === Kind.FIELD) {
      context = processFieldSelection(selection, parentTypeName, scopeData, offlineScopes)
    } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
      context = processFragmentSpread(selection, fragmentMap, visitedFragments, scopeData, offlineScopes)
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      context = processInlineFragment(selection, parentTypeName, scopeData, offlineScopes)
    } else {
      continue
    }

    if (context.nextSelectionSet && context.nextTypeName) {
      walkSelectionSet(
        context.nextSelectionSet,
        context.nextTypeName,
        scopeData,
        offlineScopes,
        fragmentMap,
        visitedFragments,
      )
    }
  }
}

/**
 * Returns the root type name for an operation. The Admin API uses `QueryRoot`
 * for queries and `Mutation` for mutations; other APIs use `Query`/`Mutation`.
 */
export function getRootTypeName(operation: string, schemaName = 'admin'): string {
  if (schemaName === 'admin') {
    return operation === 'mutation' ? 'Mutation' : 'QueryRoot'
  }
  return operation === 'mutation' ? 'Mutation' : 'Query'
}

/**
 * Formats the required-scopes note appended to a successful validation message.
 * Returns '' when there are no scopes, so callers can append unconditionally.
 */
export function formatScopes(scopes: string[] | undefined | null): string {
  if (!scopes || scopes.length === 0) {
    return ''
  }

  return `\nRequired scopes: ${scopes.join(', ')}`
}

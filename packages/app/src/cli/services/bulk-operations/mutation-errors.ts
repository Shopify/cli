import {getOperationAST, Kind, parse, type FieldNode, type FragmentDefinitionNode, type SelectionSetNode} from 'graphql'

export function resultsContainMutationErrors(results: string, query: string): boolean {
  const document = parse(query)
  const fragments = new Map(
    document.definitions
      .filter((definition) => definition.kind === Kind.FRAGMENT_DEFINITION)
      .map((fragment) => [fragment.name.value, fragment]),
  )
  const operation = getOperationAST(document)
  const errorFields =
    operation?.operation === 'mutation'
      ? selectedFields(operation.selectionSet, fragments).flatMap((mutation) =>
          mutation.selectionSet
            ? selectedFields(mutation.selectionSet, fragments)
                .filter((field) => field.name.value === 'userErrors')
                .map((field): [string, string] => [
                  mutation.alias?.value ?? mutation.name.value,
                  field.alias?.value ?? field.name.value,
                ])
            : [],
        )
      : []

  return results
    .trim()
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .some((line) => {
      let result
      try {
        result = JSON.parse(line)
      } catch (error) {
        if (error instanceof SyntaxError) return false
        throw error
      }
      if (Array.isArray(result.errors) && result.errors.length > 0) return true
      return errorFields.some(([mutation, field]) => {
        const errors = result.data?.[mutation]?.[field]
        return Array.isArray(errors) && errors.length > 0
      })
    })
}

function selectedFields(
  selectionSet: SelectionSetNode,
  fragments: Map<string, FragmentDefinitionNode>,
  activeFragments: string[] = [],
): FieldNode[] {
  return selectionSet.selections.flatMap((selection): FieldNode[] => {
    if (selection.kind === Kind.FIELD) return [selection]
    if (selection.kind === Kind.INLINE_FRAGMENT) {
      return selectedFields(selection.selectionSet, fragments, activeFragments)
    }
    const name = selection.name.value
    const fragment = fragments.get(name)
    return fragment && !activeFragments.includes(name)
      ? selectedFields(fragment.selectionSet, fragments, [...activeFragments, name])
      : []
  })
}

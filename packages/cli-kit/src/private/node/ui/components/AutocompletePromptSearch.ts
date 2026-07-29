import {Item as SelectItem} from './SelectInput.js'

export function filterAutocompleteChoices<T>(choices: SelectItem<T>[], term: string): SelectItem<T>[] {
  const lowerTerm = term.toLowerCase()

  return choices.filter((choice) => {
    const searchableValues = [choice.label, choice.group, choice.helperText]

    return searchableValues.some((value) => value?.toLowerCase().includes(lowerTerm))
  })
}

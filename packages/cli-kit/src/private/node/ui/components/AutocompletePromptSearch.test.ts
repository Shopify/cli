import {filterAutocompleteChoices} from './AutocompletePromptSearch.js'
import {describe, expect, test} from 'vitest'

const choices = [
  {
    label: 'Dawn',
    value: 'dawn',
    group: 'Unpublished',
    helperText: '#123456789',
  },
  {
    label: 'Studio',
    value: 'studio',
    group: 'Live',
    helperText: '#987654321',
  },
]

describe('filterAutocompleteChoices', () => {
  test.each([
    ['label', 'DAWN', 'dawn'],
    ['group', 'live', 'studio'],
    ['helper text', '123456789', 'dawn'],
    ['prefixed helper text', '#987654321', 'studio'],
  ])('filters by %s case-insensitively', (_criterion, term, expectedValue) => {
    expect(filterAutocompleteChoices(choices, term).map(({value}) => value)).toEqual([expectedValue])
  })

  test('returns no choices when the term does not match', () => {
    expect(filterAutocompleteChoices(choices, 'nonexistent')).toEqual([])
  })
})

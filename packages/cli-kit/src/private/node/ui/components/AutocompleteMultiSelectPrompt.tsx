import {MultiSelectInput, MultiSelectInputProps} from './MultiSelectInput.js'
import {Item as SelectItem} from './SelectInput.js'
import {InfoTableProps} from './Prompts/InfoTable.js'
import {TextInput} from './TextInput.js'
import {InfoMessageProps} from './Prompts/InfoMessage.js'
import {Message, PromptLayout} from './Prompts/PromptLayout.js'
import {AbortSignal} from '../../../../public/node/abort.js'
import {useComplete} from '../../ui.js'
import usePrompt, {PromptState} from '../hooks/use-prompt.js'

import React, {ReactElement, useCallback, useEffect, useMemo, useState} from 'react'
import {Box} from 'ink'

export interface AutocompleteMultiSelectPromptProps<T> {
  message: Message
  choices: MultiSelectInputProps<T>['items']
  onSubmit: (values: T[]) => void
  infoTable?: InfoTableProps['table']
  defaultValue?: T[]
  abortSignal?: AbortSignal
  infoMessage?: InfoMessageProps['message']
  groupOrder?: string[]
}

// Beyond this many labels the submitted line stops being a summary, so we count the rest instead.
const MAX_LABELS_IN_SUBMITTED_ANSWER = 3

/**
 * A multi-select (checkbox) list with a search box above it. The checked set lives here rather than
 * inside MultiSelectInput so that it survives the list being filtered down and back out again.
 *
 * Filtering is in-memory only. Async/remote search is the future upgrade path; it would force the
 * checked set from `Set<T>` to `Map<T, Item<T>>`, because a checked item's label can leave `choices`
 * entirely once the results come from a backend.
 */
function AutocompleteMultiSelectPrompt<T>({
  message,
  choices,
  infoTable,
  infoMessage,
  onSubmit,
  defaultValue,
  abortSignal,
  groupOrder,
}: React.PropsWithChildren<AutocompleteMultiSelectPromptProps<T>>): ReactElement | null {
  if (choices.length === 0) {
    throw new Error('AutocompleteMultiSelectPrompt requires at least one choice')
  }

  const complete = useComplete()
  const [searchTerm, setSearchTerm] = useState('')
  // Owned here, not in MultiSelectInput: filtering swaps the items array underneath the list, and
  // the user's checks have to outlive that.
  const [selectedValues, setSelectedValues] = useState<Set<T>>(() => new Set(defaultValue ?? []))
  const {promptState, setPromptState, answer, setAnswer} = usePrompt<SelectItem<T>[]>({
    initialAnswer: [],
  })

  // Match on label OR group, case-insensitive substring — the same predicate the single-select
  // autocomplete uses. Deliberately NOT description: matching prose the user can't see in the row
  // produces results they can't explain.
  const filteredChoices = useMemo(() => {
    const term = searchTerm.toLowerCase()
    if (term.length === 0) return choices
    return choices.filter((item) => item.label.toLowerCase().includes(term) || item.group?.toLowerCase().includes(term))
  }, [choices, searchTerm])

  const submitAnswer = useCallback(
    (answer: SelectItem<T>[]) => {
      setAnswer(answer)
      setPromptState(PromptState.Submitted)
    },
    [setAnswer, setPromptState],
  )

  useEffect(() => {
    if (promptState === PromptState.Submitted) {
      setSearchTerm('')
      onSubmit(answer.map((item) => item.value))
      complete()
    }
  }, [answer, onSubmit, promptState, complete])

  // Selecting zero items is valid, so fall back to a descriptive label rather than leaving the
  // submitted state blank. Past a handful of labels the line stops being readable (scope lists run
  // to 30+ entries), so summarise the tail instead of joining everything.
  let submittedAnswerLabel: string
  if (answer.length === 0) {
    submittedAnswerLabel = 'Nothing selected'
  } else if (answer.length <= MAX_LABELS_IN_SUBMITTED_ANSWER) {
    submittedAnswerLabel = answer.map((item) => item.label).join(', ')
  } else {
    const shown = answer
      .slice(0, MAX_LABELS_IN_SUBMITTED_ANSWER)
      .map((item) => item.label)
      .join(', ')
    submittedAnswerLabel = `${shown} and ${answer.length - MAX_LABELS_IN_SUBMITTED_ANSWER} more`
  }

  return (
    <PromptLayout
      message={message}
      state={promptState}
      infoTable={infoTable}
      infoMessage={infoMessage}
      abortSignal={abortSignal}
      submittedAnswerLabel={submittedAnswerLabel}
      header={
        promptState === PromptState.Submitted ? null : (
          <Box marginLeft={3}>
            {/* `ignoreSpace` hands the space key to the list below, where it toggles the focused
                checkbox. A search box that swallowed it would make the primary interaction of a
                multi-select unreachable while the search box has focus (which is always). */}
            <TextInput value={searchTerm} onChange={setSearchTerm} ignoreSpace placeholder="Type to search..." />
          </Box>
        )
      }
      input={
        <MultiSelectInput
          items={filteredChoices}
          // The UNFILTERED list: it is both the submit source (so checked-but-hidden items survive)
          // and the height source (so the list box doesn't resize on every keystroke).
          initialItems={choices}
          selectedValues={selectedValues}
          onSelectedValuesChange={setSelectedValues}
          highlightedTerm={searchTerm}
          showSelectionCount
          emptyMessage="No results found."
          onSubmit={submitAnswer}
          groupOrder={groupOrder}
        />
      }
    />
  )
}

export {AutocompleteMultiSelectPrompt}

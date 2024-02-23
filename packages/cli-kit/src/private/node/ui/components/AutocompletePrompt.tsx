import {SelectInput, SelectInputProps, Item as SelectItem} from './SelectInput.js'
import {InfoTableProps} from './Prompts/InfoTable.js'
import {TextInput} from './TextInput.js'
import {InfoMessageProps} from './Prompts/InfoMessage.js'
import {Message, PromptLayout} from './Prompts/PromptLayout.js'
import {debounce} from '../../../../public/common/function.js'
import {AbortSignal} from '../../../../public/node/abort.js'
import usePrompt, {PromptState} from '../hooks/use-prompt.js'
import React, {ReactElement, useCallback, useEffect, useRef, useState} from 'react'
import {Box, useApp} from 'ink'

export interface SearchResults<T> {
  data: SelectItem<T>[]
  meta?: {
    hasNextPage: boolean
  }
}

export interface AutocompletePromptProps<T> {
  message: Message
  choices: SelectInputProps<T>['items']
  onSubmit: (value: T) => void
  infoTable?: InfoTableProps['table']
  hasMorePages?: boolean
  search: (term: string) => Promise<SearchResults<T>>
  abortSignal?: AbortSignal
  infoMessage?: InfoMessageProps['message']
}

const MIN_NUMBER_OF_ITEMS_FOR_SEARCH = 5

// eslint-disable-next-line react/function-component-definition
function AutocompletePrompt<T>({
  message,
  choices,
  infoTable,
  onSubmit,
  search,
  hasMorePages: initialHasMorePages = false,
  abortSignal,
  infoMessage,
}: React.PropsWithChildren<AutocompletePromptProps<T>>): ReactElement | null {
  const {exit: unmountInk} = useApp()
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<SelectItem<T>[]>(choices)
  const canSearch = choices.length > MIN_NUMBER_OF_ITEMS_FOR_SEARCH
  const [hasMorePages, setHasMorePages] = useState(initialHasMorePages)
  const {promptState, setPromptState, answer, setAnswer} = usePrompt<SelectItem<T> | undefined>({
    initialAnswer: undefined,
  })

  const paginatedSearch = useCallback(
    async (term: string) => {
      const results = await search(term)
      return results
    },
    [search],
  )

  const submitAnswer = useCallback(
    (answer: SelectItem<T>) => {
      if (promptState === PromptState.Idle) {
        setAnswer(answer)
        setPromptState(PromptState.Submitted)
      }
    },
    [promptState, setAnswer, setPromptState],
  )

  useEffect(() => {
    if (promptState === PromptState.Submitted && answer) {
      setSearchTerm('')
      unmountInk()
      onSubmit(answer.value)
    }
  }, [answer, onSubmit, promptState, unmountInk])

  const setLoadingWhenSlow = useRef<NodeJS.Timeout>()

  // we want to set it each time so that searchTermRef always tracks searchTerm,
  // this is NOT the same as writing useRef(searchTerm)
  const searchTermRef = useRef('')
  searchTermRef.current = searchTerm

  // disable exhaustive-deps because we want to memoize the debounce function itself
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debounceSearch = useCallback(
    debounce((term: string) => {
      setLoadingWhenSlow.current = setTimeout(() => {
        setPromptState(PromptState.Loading)
      }, 100)
      paginatedSearch(term)
        .then((result) => {
          // while we were waiting for the promise to resolve, the user
          // has emptied the search term, so we want to show the default
          // choices instead
          if (searchTermRef.current.length === 0) {
            setSearchResults(choices)
            setHasMorePages(initialHasMorePages)
          } else {
            setSearchResults(result.data)
            setHasMorePages(result.meta?.hasNextPage ?? false)
          }

          setPromptState(PromptState.Idle)
        })
        .catch(() => {
          setPromptState(PromptState.Error)
        })
        .finally(() => {
          clearTimeout(setLoadingWhenSlow.current)
        })
    }, 300),
    [initialHasMorePages, choices, paginatedSearch, searchResults],
  )

  return (
    <PromptLayout
      message={message}
      state={promptState}
      infoTable={infoTable}
      infoMessage={infoMessage}
      abortSignal={abortSignal}
      header={
        promptState !== PromptState.Submitted && canSearch ? (
          <Box marginLeft={3}>
            <TextInput
              value={searchTerm}
              onChange={(term) => {
                setSearchTerm(term)

                if (term.length > 0) {
                  debounceSearch(term)
                } else {
                  debounceSearch.cancel()
                  setPromptState(PromptState.Idle)
                  setSearchResults(choices)
                }
              }}
              placeholder="Type to search..."
            />
          </Box>
        ) : null
      }
      submittedAnswerLabel={answer?.label}
      input={
        <SelectInput
          items={searchResults}
          initialItems={choices}
          enableShortcuts={false}
          emptyMessage="No results found."
          highlightedTerm={searchTerm}
          loading={promptState === PromptState.Loading}
          errorMessage={
            promptState === PromptState.Error
              ? 'There has been an error while searching. Please try again later.'
              : undefined
          }
          hasMorePages={hasMorePages}
          morePagesMessage="Find what you're looking for by typing its name."
          onSubmit={submitAnswer}
        />
      }
    />
  )
}

export {AutocompletePrompt}

import {SelectInput, SelectInputProps, Item as SelectItem} from './SelectInput.js'
import {InfoTable, InfoTableProps} from './Prompts/InfoTable.js'
import {TextInput} from './TextInput.js'
import {TokenizedText} from './TokenizedText.js'
import {InfoMessage} from './SelectPrompt.js'
import {messageWithPunctuation} from '../utilities.js'
import {debounce} from '../../../../public/common/function.js'
import {AbortSignal} from '../../../../public/node/abort.js'
import useAbortSignal from '../hooks/use-abort-signal.js'
import React, {ReactElement, useCallback, useLayoutEffect, useRef, useState} from 'react'
import {Box, measureElement, Text, useApp, useStdout} from 'ink'
import figures from 'figures'
import ansiEscapes from 'ansi-escapes'

export interface SearchResults<T> {
  data: SelectItem<T>[]
  meta?: {
    hasNextPage: boolean
  }
}

export interface AutocompletePromptProps<T> {
  message: string
  choices: SelectInputProps<T>['items']
  onSubmit: (value: T) => void
  infoTable?: InfoTableProps['table']
  hasMorePages?: boolean
  search: (term: string) => Promise<SearchResults<T>>
  abortSignal?: AbortSignal
  infoMessage?: InfoMessage
}

enum PromptState {
  Idle = 'idle',
  Loading = 'loading',
  Submitted = 'submitted',
  Error = 'error',
}

const PAGE_SIZE = 25
const MIN_NUMBER_OF_ITEMS_FOR_SEARCH = 5

// eslint-disable-next-line react/function-component-definition
function AutocompletePrompt<T>({
  message,
  choices: initialChoices,
  infoTable,
  onSubmit,
  search,
  hasMorePages: initialHasMorePages = false,
  abortSignal,
  infoMessage,
}: React.PropsWithChildren<AutocompletePromptProps<T>>): ReactElement | null {
  const paginatedInitialChoices = initialChoices.slice(0, PAGE_SIZE)
  const [answer, setAnswer] = useState<SelectItem<T> | undefined>(paginatedInitialChoices[0])
  const {exit: unmountInk} = useApp()
  const [promptState, setPromptState] = useState<PromptState>(PromptState.Idle)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<SelectItem<T>[]>(paginatedInitialChoices.slice(0, PAGE_SIZE))
  const {stdout} = useStdout()
  const canSearch = initialChoices.length > MIN_NUMBER_OF_ITEMS_FOR_SEARCH
  const [hasMorePages, setHasMorePages] = useState(initialHasMorePages)
  const [wrapperHeight, setWrapperHeight] = useState(0)
  const [promptAreaHeight, setPromptAreaHeight] = useState(0)
  const currentAvailableLines = stdout.rows - promptAreaHeight - 5
  const [availableLines, setAvailableLines] = useState(currentAvailableLines)

  const paginatedSearch = useCallback(
    async (term: string) => {
      const results = await search(term)
      results.data = results.data.slice(0, PAGE_SIZE)
      return results
    },
    [search],
  )

  const wrapperRef = useCallback(
    (node) => {
      if (node !== null) {
        const {height} = measureElement(node)
        if (wrapperHeight !== height) {
          setWrapperHeight(height)
        }
      }
    },
    [wrapperHeight],
  )

  const promptAreaRef = useCallback((node) => {
    if (node !== null) {
      const {height} = measureElement(node)
      setPromptAreaHeight(height)
    }
  }, [])

  useLayoutEffect(() => {
    function onResize() {
      const newAvailableLines = stdout.rows - promptAreaHeight - 5
      if (newAvailableLines !== availableLines) {
        setAvailableLines(newAvailableLines)
      }
    }

    onResize()

    stdout.on('resize', onResize)
    return () => {
      stdout.off('resize', onResize)
    }
  }, [wrapperHeight, promptAreaHeight, searchResults.length, stdout, availableLines])

  const {isAborted} = useAbortSignal(abortSignal)

  const submitAnswer = useCallback(
    (answer: SelectItem<T>) => {
      if (promptState === PromptState.Idle) {
        // -1 is for the last row with the terminal cursor
        if (stdout && wrapperHeight >= stdout.rows - 1) {
          stdout.write(ansiEscapes.clearTerminal)
        }
        setAnswer(answer)
        setPromptState(PromptState.Submitted)
        setSearchTerm('')
        unmountInk()
        onSubmit(answer.value)
      }
    },
    [promptState, stdout, wrapperHeight, onSubmit, unmountInk],
  )

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
            setSearchResults(paginatedInitialChoices)
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
    [initialHasMorePages, paginatedInitialChoices, paginatedSearch, searchResults],
  )

  return isAborted ? null : (
    <Box flexDirection="column" marginBottom={1} ref={wrapperRef}>
      <Box ref={promptAreaRef}>
        <Box marginRight={2}>
          <Text>?</Text>
        </Box>
        <TokenizedText item={messageWithPunctuation(message)} />
        {promptState !== PromptState.Submitted && canSearch ? (
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
                  setSearchResults(paginatedInitialChoices)
                }
              }}
              placeholder="Type to search..."
            />
          </Box>
        ) : null}
      </Box>

      {(infoTable || infoMessage) && promptState !== PromptState.Submitted ? (
        <Box
          marginTop={1}
          marginLeft={3}
          paddingLeft={2}
          borderStyle="bold"
          borderLeft
          borderRight={false}
          borderTop={false}
          borderBottom={false}
          flexDirection="column"
          gap={1}
        >
          {infoMessage ? (
            <Box flexDirection="column" gap={1}>
              <Text color={infoMessage.title.color}>
                <TokenizedText item={infoMessage.title.text} />
              </Text>
              <TokenizedText item={infoMessage.body} />
            </Box>
          ) : null}
          {infoTable ? <InfoTable table={infoTable} /> : null}
        </Box>
      ) : null}

      {promptState === PromptState.Submitted ? (
        <Box>
          <Box marginRight={2}>
            <Text color="cyan">{figures.tick}</Text>
          </Box>

          <Text color="cyan">{answer!.label}</Text>
        </Box>
      ) : (
        <Box marginTop={1}>
          <SelectInput
            items={searchResults}
            initialItems={paginatedInitialChoices}
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
            availableLines={availableLines}
            onSubmit={submitAnswer}
          />
        </Box>
      )}
    </Box>
  )
}

export {AutocompletePrompt}

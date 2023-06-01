import {SelectInput, SelectInputProps, Item as SelectItem} from './SelectInput.js'
import {InfoTable, InfoTableProps} from './Prompts/InfoTable.js'
import {TextInput} from './TextInput.js'
import {TokenizedText} from './TokenizedText.js'
import {handleCtrlC} from '../../ui.js'
import {messageWithPunctuation} from '../utilities.js'
import {debounce} from '../../../../public/common/function.js'
import {AbortSignal} from '../../../../public/node/abort.js'
import useAbortSignal from '../hooks/use-abort-signal.js'
import React, {ReactElement, useCallback, useLayoutEffect, useRef, useState} from 'react'
import {Box, measureElement, Text, useApp, useInput, useStdout} from 'ink'
import figures from 'figures'
import ansiEscapes from 'ansi-escapes'
import {uniqBy} from '@shopify/cli-kit/common/array'

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
}

enum PromptState {
  Idle = 'idle',
  Loading = 'loading',
  Submitted = 'submitted',
  Error = 'error',
}

const PAGE_SIZE = 25

// eslint-disable-next-line react/function-component-definition
function AutocompletePrompt<T>({
  message,
  choices: initialChoices,
  infoTable,
  onSubmit,
  search,
  hasMorePages: initialHasMorePages = false,
  abortSignal,
}: React.PropsWithChildren<AutocompletePromptProps<T>>): ReactElement | null {
  const paginatedInitialChoices = initialChoices.slice(0, PAGE_SIZE)
  const [answer, setAnswer] = useState<SelectItem<T> | undefined>(paginatedInitialChoices[0])
  const {exit: unmountInk} = useApp()
  const [promptState, setPromptState] = useState<PromptState>(PromptState.Idle)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<SelectItem<T>[]>(paginatedInitialChoices.slice(0, PAGE_SIZE))
  const {stdout} = useStdout()
  const canSearch = initialChoices.length >= PAGE_SIZE
  const [hasMorePages, setHasMorePages] = useState(initialHasMorePages)
  const [wrapperHeight, setWrapperHeight] = useState(0)
  const [selectInputHeight, setSelectInputHeight] = useState(0)
  const [limit, setLimit] = useState(searchResults.length)
  const numberOfGroups = uniqBy(
    searchResults.filter((choice) => choice.group),
    'group',
  ).length

  const paginatedSearch = useCallback(
    async (term: string) => {
      const results = await search(term)
      results.data = results.data.slice(0, PAGE_SIZE)
      return results
    },
    [search],
  )

  const wrapperRef = useCallback((node) => {
    if (node !== null) {
      const {height} = measureElement(node)
      setWrapperHeight(height)
    }
  }, [])

  const inputRef = useCallback((node) => {
    if (node !== null) {
      const {height} = measureElement(node)
      setSelectInputHeight(height)
    }
  }, [])

  useLayoutEffect(() => {
    function onResize() {
      const availableSpace = stdout.rows - (wrapperHeight - selectInputHeight)
      // rough estimate of the limit needed based on the space available
      const newLimit = Math.max(2, availableSpace - numberOfGroups * 2 - 4)

      if (newLimit < limit) {
        stdout.write(ansiEscapes.clearTerminal)
      }

      setLimit(Math.min(newLimit, searchResults.length))
    }

    onResize()

    stdout.on('resize', onResize)
    return () => {
      stdout.off('resize', onResize)
    }
  }, [wrapperHeight, selectInputHeight, searchResults.length, stdout, limit, numberOfGroups])

  const {isAborted} = useAbortSignal(abortSignal)

  useInput((input, key) => {
    handleCtrlC(input, key)

    if (key.return && promptState === PromptState.Idle && answer) {
      // -1 is for the last row with the terminal cursor
      if (stdout && wrapperHeight >= stdout.rows - 1) {
        stdout.write(ansiEscapes.clearTerminal)
      }
      setPromptState(PromptState.Submitted)
      setSearchTerm('')
      unmountInk()
      onSubmit(answer.value)
    }
  })

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
    [initialHasMorePages, paginatedInitialChoices, paginatedSearch],
  )

  return isAborted ? null : (
    <Box flexDirection="column" marginBottom={1} ref={wrapperRef}>
      <Box>
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

      {infoTable && promptState !== PromptState.Submitted ? (
        <Box marginLeft={7} marginTop={1}>
          <InfoTable table={infoTable} />
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
            onChange={({item}) => {
              setAnswer(item)
            }}
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
            ref={inputRef}
            limit={limit}
          />
        </Box>
      )}
    </Box>
  )
}

export {AutocompletePrompt}

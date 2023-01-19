import SelectInput, {Props as SelectProps, Item as SelectItem, Item} from './SelectInput.js'
import InfoTable, {Props as InfoTableProps} from './Prompts/InfoTable.js'
import {TextInput} from './TextInput.js'
import {handleCtrlC} from '../../ui.js'
import React, {ReactElement, useCallback, useRef, useState} from 'react'
import {Box, measureElement, Text, useApp, useInput, useStdout} from 'ink'
import {figures} from 'listr2'
import {debounce} from '@shopify/cli-kit/common/function'
import ansiEscapes from 'ansi-escapes'

export interface Props<T> {
  message: string
  choices: SelectProps<T>['items']
  onSubmit: (value: T) => void
  infoTable?: InfoTableProps['table']
  search: (term: string) => Promise<SelectItem<T>[]>
}

enum PromptState {
  Idle = 'idle',
  Loading = 'loading',
  Submitted = 'submitted',
  Error = 'error',
}

const PAGE_SIZE = 25

function AutocompletePrompt<T>({
  message,
  choices: initialChoices,
  infoTable,
  onSubmit,
  search,
}: React.PropsWithChildren<Props<T>>): ReactElement | null {
  const paginatedInitialChoices = initialChoices.slice(0, PAGE_SIZE)
  const [answer, setAnswer] = useState<SelectItem<T> | undefined>(paginatedInitialChoices[0])
  const {exit: unmountInk} = useApp()
  const [promptState, setPromptState] = useState<PromptState>(PromptState.Idle)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<SelectItem<T>[]>(paginatedInitialChoices.slice(0, PAGE_SIZE))
  const {stdout} = useStdout()
  const [height, setHeight] = useState(0)

  const paginatedSearch = useCallback(async (term: string) => {
    const results = await search(term)
    return results.slice(0, PAGE_SIZE)
  }, [])

  const measuredRef = useCallback(
    (node) => {
      if (node !== null) {
        const {height} = measureElement(node)
        setHeight(height)
      }
    },
    [searchResults, promptState],
  )

  useInput(
    useCallback(
      (input, key) => {
        handleCtrlC(input, key)

        if (key.return && promptState === PromptState.Idle && answer) {
          if (stdout && height >= stdout.rows) {
            stdout.write(ansiEscapes.clearTerminal)
          }
          setPromptState(PromptState.Submitted)
          setSearchTerm('')
          unmountInk()
          onSubmit(answer.value)
        }
      },
      [answer, onSubmit, height, promptState],
    ),
  )

  const setLoadingWhenSlow = useRef<NodeJS.Timeout>()

  // we want to set it each time so that searchTermRef always tracks searchTerm,
  // this is NOT the same as writing useRef(searchTerm)
  const searchTermRef = useRef('')
  searchTermRef.current = searchTerm

  const debounceSearch = useCallback(
    debounce((term) => {
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
          } else {
            setSearchResults(result)
          }

          setPromptState(PromptState.Idle)
        })
        .catch(() => {
          setPromptState(PromptState.Error)
        })
        .finally(() => {
          clearTimeout(setLoadingWhenSlow.current!)
        })
    }, 300),
    [],
  )

  return (
    <Box flexDirection="column" marginBottom={1} ref={measuredRef}>
      <Box>
        <Box marginRight={2}>
          <Text>?</Text>
        </Box>
        <Text>{message}</Text>
        {promptState !== PromptState.Submitted && (
          <Box>
            <Text>: </Text>
            <Box>
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
          </Box>
        )}
      </Box>

      {infoTable && promptState !== PromptState.Submitted && (
        <Box marginLeft={7} marginTop={1}>
          <InfoTable table={infoTable} />
        </Box>
      )}

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
            onChange={(item: Item<T> | undefined) => {
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
          />
        </Box>
      )}
    </Box>
  )
}

export {AutocompletePrompt}

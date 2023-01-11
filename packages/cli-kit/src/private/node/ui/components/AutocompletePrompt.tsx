import SelectInput, {Props as SelectProps, Item as SelectItem, Item} from './SelectInput.js'
import Table, {Props as TableProps} from './Table.js'
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
  infoTable?: TableProps['table']
  search?: (term: string) => Promise<SelectItem<T>[]>
}

enum PromptState {
  Idle = 'idle',
  Loading = 'loading',
  Submitted = 'submitted',
}

function AutocompletePrompt<T>({
  message,
  choices,
  infoTable,
  onSubmit,
  search,
}: React.PropsWithChildren<Props<T>>): ReactElement | null {
  const [answer, setAnswer] = useState<SelectItem<T>>(choices[0]!)
  const {exit: unmountInk} = useApp()
  const [promptState, setPromptState] = useState<PromptState>(PromptState.Idle)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<SelectItem<T>[]>(choices)
  const {stdout} = useStdout()
  const [height, setHeight] = useState(0)

  const measuredRef = useCallback((node) => {
    if (node !== null) {
      const {height} = measureElement(node)
      setHeight(height)
    }
  }, [])

  useInput(
    useCallback(
      (input, key) => {
        handleCtrlC(input, key)

        if (key.return) {
          if (stdout && height >= stdout.rows) {
            stdout.write(ansiEscapes.clearTerminal)
          }
          setPromptState(PromptState.Submitted)
          unmountInk()
          onSubmit(answer.value)
        }
      },
      [answer, onSubmit, height],
    ),
  )

  const setLoadingWhenSlow = useRef<NodeJS.Timeout>()

  const debounceSearch = useCallback(
    debounce((term) => {
      setLoadingWhenSlow.current = setTimeout(() => {
        setPromptState(PromptState.Loading)
      }, 100)
      search!(term)
        .then((result) => {
          setSearchResults(result.slice(0, 14))
        })
        .catch(() => {})
        .finally(() => {
          clearTimeout(setLoadingWhenSlow.current!)
          setPromptState(PromptState.Idle)
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
                    setSearchResults(choices)
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
          <Table table={infoTable} />
        </Box>
      )}

      {promptState === PromptState.Submitted && (
        <Box>
          <Box marginRight={2}>
            <Text color="cyan">{figures.tick}</Text>
          </Box>

          <Text color="cyan">{answer.label}</Text>
        </Box>
      )}

      {promptState === PromptState.Loading && (
        <Box marginTop={1} marginLeft={3}>
          <Text dimColor>Loading...</Text>
        </Box>
      )}

      {promptState === PromptState.Idle &&
        (searchResults.length > 0 ? (
          <Box marginTop={1}>
            <SelectInput
              items={searchResults}
              onChange={(item: Item<T>) => {
                setAnswer(item)
              }}
              enableShortcuts={false}
            />
          </Box>
        ) : (
          <Box marginTop={1} marginLeft={3}>
            <Text dimColor>No results found.</Text>
          </Box>
        ))}
    </Box>
  )
}

export {AutocompletePrompt}

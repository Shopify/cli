import SelectInput, {Props as SelectProps, Item as SelectItem, Item} from './SelectInput.js'
import Table, {Props as TableProps} from './Table.js'
import {TextInput} from './TextInput.js'
import {handleCtrlC} from '../../ui.js'
import React, {ReactElement, useCallback, useRef, useState} from 'react'
import {Box, measureElement, Text, useApp, useInput, useStdout} from 'ink'
import {figures} from 'listr2'
import {debounce} from '@shopify/cli-kit/common/function'
import ansiEscapes from 'ansi-escapes'
import chalk from 'chalk'

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
  Error = 'error',
}

function AutocompletePrompt<T>({
  message,
  choices: initialChoices,
  infoTable,
  onSubmit,
  search,
}: React.PropsWithChildren<Props<T>>): ReactElement | null {
  const [answer, setAnswer] = useState<SelectItem<T> | undefined>(initialChoices[0])
  const {exit: unmountInk} = useApp()
  const [promptState, setPromptState] = useState<PromptState>(PromptState.Idle)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<SelectItem<T>[]>(initialChoices)
  const {stdout} = useStdout()
  const [height, setHeight] = useState(0)

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
          unmountInk()
          onSubmit(answer.value)
        }
      },
      [answer, onSubmit, height, promptState],
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
          const regex = new RegExp(term, 'i')
          const items = result.map((item) => {
            const match = item.label.match(regex)
            if (match) {
              const [matched] = match
              const [before, after] = item.label.split(matched!)
              return {
                ...item,
                label: `${before}${chalk.bold(matched)}${after}`,
              }
            }
            return item
          })

          setSearchResults(items)
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
                    setSearchResults(initialChoices)
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

          <Text color="cyan">{answer!.label}</Text>
        </Box>
      )}

      {promptState === PromptState.Loading && (
        <Box marginTop={1} marginLeft={3}>
          <Text dimColor>Loading...</Text>
        </Box>
      )}

      {promptState === PromptState.Error && (
        <Box marginTop={1} marginLeft={3}>
          <Text color="red">There has been an error while searching. Please try again later.</Text>
        </Box>
      )}

      {promptState === PromptState.Idle && (
        <Box marginTop={1}>
          <SelectInput
            items={searchResults.slice(0, 14)}
            onChange={(item: Item<T> | undefined) => {
              setAnswer(item)
            }}
            enableShortcuts={false}
            emptyMessage="No results found."
          />
        </Box>
      )}
    </Box>
  )
}

export {AutocompletePrompt}

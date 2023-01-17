import SelectInput, {Props as SelectProps, Item as SelectItem, Item} from './SelectInput.js'
import Table, {Props as TableProps} from './Table.js'
import {TokenItem, TokenizedText} from './TokenizedText.js'
import {handleCtrlC} from '../../ui.js'
import React, {ReactElement, useCallback, useState} from 'react'
import {Box, measureElement, Text, useApp, useInput, useStdout} from 'ink'
import {figures} from 'listr2'
import ansiEscapes from 'ansi-escapes'

export interface Props<T> {
  message: TokenItem
  choices: SelectProps<T>['items']
  onSubmit: (value: T) => void
  infoTable?: TableProps['table']
}

function SelectPrompt<T>({
  message,
  choices,
  infoTable,
  onSubmit,
}: React.PropsWithChildren<Props<T>>): ReactElement | null {
  const [answer, setAnswer] = useState<SelectItem<T>>(choices[0]!)
  const {exit: unmountInk} = useApp()
  const [submitted, setSubmitted] = useState(false)
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
          setSubmitted(true)
          unmountInk()
          onSubmit(answer.value)
        }
      },
      [answer, onSubmit, height],
    ),
  )

  return (
    <Box flexDirection="column" marginBottom={1} ref={measuredRef}>
      <Box>
        <Box marginRight={2}>
          <Text>?</Text>
        </Box>
        <TokenizedText item={message} />
      </Box>
      {infoTable && !submitted && (
        <Box marginLeft={7}>
          <Table table={infoTable} />
        </Box>
      )}
      {submitted ? (
        <Box>
          <Box marginRight={2}>
            <Text color="cyan">{figures.tick}</Text>
          </Box>

          <Text color="cyan">{answer.label}</Text>
        </Box>
      ) : (
        <SelectInput
          items={choices}
          onChange={(item: Item<T>) => {
            setAnswer(item)
          }}
        />
      )}
    </Box>
  )
}

export {SelectPrompt}

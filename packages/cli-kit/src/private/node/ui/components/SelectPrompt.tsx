import SelectInput, {Props as SelectProps, Item as SelectItem, Item} from './SelectInput.js'
import Table, {Props as TableProps} from './Table.js'
import {handleCtrlC} from '../../ui.js'
import React, {useCallback, useState} from 'react'
import {Box, Text, useApp, useInput} from 'ink'
import {figures} from 'listr2'

export interface Props<T> {
  message: string
  choices: SelectProps<T>['items']
  onChoose: (value: T) => void
  infoTable?: TableProps['table']
}

export default function SelectPrompt<T>({
  message,
  choices,
  infoTable,
  onChoose,
}: React.PropsWithChildren<Props<T>>): JSX.Element | null {
  const [answer, setAnswer] = useState<SelectItem<T>>(choices[0]!)
  const {exit: unmountInk} = useApp()
  const [submitted, setSubmitted] = useState(false)

  useInput(
    useCallback(
      (input, key) => {
        handleCtrlC(input, key)

        if (key.return) {
          setSubmitted(true)
          onChoose(answer.value)
          unmountInk()
        }
      },
      [answer, onChoose],
    ),
  )

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Box marginRight={2}>
          <Text>?</Text>
        </Box>
        <Text>{message}</Text>
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

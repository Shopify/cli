import SelectInput, {Props as SelectProps, Item as SelectItem} from './SelectInput.js'
import Table, {Props as TableProps} from './Table.js'
import React, {useState} from 'react'
import {Box, Text} from 'ink'
import {figures} from 'listr2'

export interface Props<T> {
  message: string
  choices: SelectProps<T>['items']
  onChoose?: SelectProps<T>['onSelect']
  infoTable?: TableProps['table']
}

export default function Prompt<T>({
  message,
  choices,
  infoTable,
  onChoose = () => {},
}: React.PropsWithChildren<Props<T>>): JSX.Element | null {
  const [answer, setAnswer] = useState<SelectItem<T> | null>(null)

  return (
    <Box flexDirection="column">
      <Box>
        <Box marginRight={2}>
          <Text>?</Text>
        </Box>
        <Text>{message}</Text>
      </Box>
      {infoTable && (
        <Box marginLeft={7}>
          <Table table={infoTable} />
        </Box>
      )}
      {answer ? (
        <Box>
          <Box marginRight={2}>
            <Text color="cyan">{figures.tick}</Text>
          </Box>

          <Text color="cyan">{answer.label}</Text>
        </Box>
      ) : (
        <SelectInput
          items={choices}
          onSelect={(item: SelectItem<T>) => {
            setAnswer(item)
            onChoose(item)
          }}
        />
      )}
    </Box>
  )
}

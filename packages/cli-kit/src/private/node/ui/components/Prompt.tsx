import SelectInput, {Props as SelectProps, Item as SelectItem} from './SelectInput.js'
import React, {useState} from 'react'
import {Box, Text} from 'ink'
import {figures} from 'listr2'

export interface Props {
  message: string
  choices: SelectProps['items']
  onChoose?: SelectProps['onSelect']
}

const Prompt: React.FC<Props> = ({message, choices, onChoose = () => {}}): JSX.Element | null => {
  const [answer, setAnswer] = useState<SelectItem | null>(null)

  return (
    <Box flexDirection="column">
      <Box>
        <Box marginRight={2}>
          <Text>?</Text>
        </Box>
        <Text>{message}</Text>
      </Box>
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
          onSelect={(item: SelectItem) => {
            setAnswer(item)
            onChoose(item)
          }}
        />
      )}
    </Box>
  )
}

export default Prompt

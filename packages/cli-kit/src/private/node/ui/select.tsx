import SelectInput, {Props as SelectProps} from './components/SelectInput.js'
import {render} from '../ui.js'
import React from 'react'
import {Box, Text} from 'ink'

export interface PromptProps {
  message: string
  limit: SelectProps['limit']
  choices: SelectProps['items']
  onEnter: SelectProps['onSelect']
}

export function prompt(options: PromptProps) {
  render(
    <Box flexDirection="column">
      <Box>
        <Box marginRight={2}>
          <Text>?</Text>
        </Box>
        <Text>{options.message}</Text>
      </Box>
      <SelectInput items={options.choices} onSelect={options.onEnter} limit={options.limit} />
    </Box>,
  )
}

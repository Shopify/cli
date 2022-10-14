import {Banner} from './Banner.js'
import {List} from './List.js'
import {Box, Text} from 'ink'
import React from 'react'

export interface ErrorProps {
  headline: string
  tryMessages?: string[]
}

const Error: React.FC<ErrorProps> = ({headline, tryMessages}) => {
  return (
    <Banner type="error">
      <Box marginBottom={1}>
        <Text>{headline}</Text>
      </Box>

      {tryMessages && tryMessages.length > 0 && <List title="What to try" items={tryMessages} />}
    </Banner>
  )
}

export {Error}

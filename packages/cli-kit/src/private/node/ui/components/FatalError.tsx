import {Banner} from './Banner.js'
import {List} from './List.js'
import {Fatal} from '../../../../error.js'
import {Box, Text} from 'ink'
import React from 'react'

export interface FatalErrorProps {
  error: Fatal
}

const FatalError: React.FC<FatalErrorProps> = ({error}) => {
  return (
    <Banner type="error">
      <Box marginBottom={1}>
        <Text>{error.message}</Text>
      </Box>

      {error.tryMessage && <List title="What to try" items={[error.tryMessage]} />}
    </Banner>
  )
}

export {FatalError}

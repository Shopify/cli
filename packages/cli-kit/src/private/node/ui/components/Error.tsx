import {Banner} from './Banner.js'
import {TokenItem, TokenizedText} from './TokenizedText.js'
import {Box, Text} from 'ink'
import React from 'react'

export interface ErrorProps {
  headline: string
  tryMessage?: TokenItem
}

const Error: React.FC<ErrorProps> = ({headline, tryMessage}) => {
  return (
    <Banner type="error" marginY={1}>
      <Box>
        <Text>{headline}</Text>
      </Box>

      {tryMessage && (
        <Box marginTop={1}>
          <TokenizedText item={tryMessage} />
        </Box>
      )}
    </Banner>
  )
}

export {Error}

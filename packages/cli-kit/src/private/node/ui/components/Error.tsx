import {Banner} from './Banner.js'
import {TextTokenItem, TokenizedText} from './TokenizedText.js'
import {Box, Text} from 'ink'
import React from 'react'

export interface ErrorProps {
  headline: string
  tryMessage?: TextTokenItem
}

const Error: React.FC<ErrorProps> = ({headline, tryMessage}) => {
  return (
    <Banner type="error">
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

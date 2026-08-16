import {TokenizedText} from '../TokenizedText.js'
import {Box, Text, TextProps} from 'ink'
import React, {FunctionComponent} from 'react'
import type {InlineToken, LinkToken, TokenItem, UserInputToken} from '../token-item.js'

export interface InfoMessageProps {
  message: {
    title: {
      color?: TextProps['color']
      text: TokenItem<Exclude<InlineToken, UserInputToken | LinkToken>>
    }
    body: TokenItem
  }
}

const InfoMessage: FunctionComponent<InfoMessageProps> = ({
  message: {
    title: {color, text: title},
    body,
  },
}) => {
  return (
    <Box flexDirection="column" gap={1}>
      <Text color={color}>
        <TokenizedText item={title} />
      </Text>
      <TokenizedText item={body} />
    </Box>
  )
}

export {InfoMessage}

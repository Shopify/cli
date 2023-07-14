import {InlineToken, LinkToken, TokenItem, TokenizedText, UserInputToken} from '../TokenizedText.js'
import {Box, Text, TextProps} from 'ink'
import React, {FunctionComponent} from 'react'

export interface InfoMessageProps {
  message: {
    title: {
      color?: TextProps['color']
      text: TokenItem<Exclude<InlineToken, UserInputToken | LinkToken>>
    }
    body: TokenItem
  }
}

const InfoMessage: FunctionComponent<InfoMessageProps> = ({message}) => {
  return (
    <Box flexDirection="column" gap={1}>
      <Text color={message.title.color}>
        <TokenizedText item={message.title.text} />
      </Text>
      <TokenizedText item={message.body} />
    </Box>
  )
}

export {InfoMessage}

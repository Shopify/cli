import {InlineToken, TokenItem, TokenizedText} from './TokenizedText.js'
import {Box, Text, TextProps} from 'ink'
import React, {FunctionComponent} from 'react'

interface ListProps {
  title?: TokenItem<InlineToken>
  items: TokenItem<InlineToken>[]
  ordered?: boolean
  margin?: boolean
  color?: TextProps['color']
  bullet?: string
}

const DOT = '•'

/**
 * `List` displays an unordered or ordered list with text aligned with the bullet point
 * and wrapped to the container width.
 */
const List: FunctionComponent<ListProps> = ({
  title,
  items,
  margin = true,
  ordered = false,
  color,
  bullet = DOT,
}): JSX.Element => {
  return (
    <Box flexDirection="column">
      {title ? (
        <Text color={color}>
          <TokenizedText item={title} />
        </Text>
      ) : null}
      {items.map((item, index) => (
        <Box key={index} marginLeft={margin ? 2 : 0}>
          <Text color={color}>{`${ordered ? `${index + 1}.` : bullet}`}</Text>

          <Box flexGrow={1} marginLeft={1}>
            <Text color={color}>
              <TokenizedText item={item} />
            </Text>
          </Box>
        </Box>
      ))}
    </Box>
  )
}

export {List}

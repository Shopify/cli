import {InlineToken, TokenItem, TokenizedText} from './TokenizedText.js'
import {Box, Text} from 'ink'
import React, {FunctionComponent} from 'react'

interface ListProps {
  title?: string
  items: TokenItem<InlineToken>[]
  ordered?: boolean
  margin?: boolean
}

const DOT = '•'

/**
 * `List` displays an unordered or ordered list with text aligned with the bullet point
 * and wrapped to the container width.
 */
const List: FunctionComponent<ListProps> = ({title, items, margin = true, ordered = false}): JSX.Element => {
  return (
    <Box flexDirection="column">
      {title ? <Text bold>{title}</Text> : null}
      {items.map((item, index) => (
        <Box key={index}>
          <Box>
            {margin ? <Text>{'  '}</Text> : null}
            <Text>{`${ordered ? `${index + 1}.` : DOT}`}</Text>
          </Box>

          <Box flexGrow={1} marginLeft={1}>
            <TokenizedText item={item} />
          </Box>
        </Box>
      ))}
    </Box>
  )
}

export {List}

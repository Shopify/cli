import {InlineToken, TokenItem, TokenizedText} from './TokenizedText.js'
import {Box, Text, TextProps} from 'ink'
import React, {FunctionComponent} from 'react'

export interface CustomListItem {
  type?: string
  item: TokenItem<InlineToken>
  bullet?: string
  color?: TextProps['color']
}

type ListItem = TokenItem<InlineToken> | CustomListItem

interface ListProps {
  title?: TokenItem<InlineToken>
  items: ListItem[]
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
  function isCustomListItem(item: TokenItem<InlineToken> | CustomListItem): item is CustomListItem {
    return (item as CustomListItem).item !== undefined
  }

  function resolveListItem(item: ListItem, index: number) {
    const resolvedItem = {
      index,
      color,
      bullet,
      ordered,
      item: item as TokenItem<InlineToken>,
    }
    return isCustomListItem(item)
      ? {
          ...resolvedItem,
          ...item,
        }
      : resolvedItem
  }

  interface ListItemProps {
    item: TokenItem<InlineToken>
    color: TextProps['color']
    bullet: string
    index: number
    ordered: boolean
  }

  const ListItem: FunctionComponent<ListItemProps> = ({item, color, bullet, index, ordered}) => {
    return (
      <Box key={index} marginLeft={margin ? 2 : 0}>
        <Text color={color}>{`${ordered ? `${index + 1}.` : bullet}`}</Text>

        <Box flexGrow={1} marginLeft={1}>
          <Text color={color}>
            <TokenizedText item={item} />
          </Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      {title ? (
        <Text color={color}>
          <TokenizedText item={title} />
        </Text>
      ) : null}
      {items.map(resolveListItem).map(({index, item, color, bullet, ordered}) => (
        <ListItem key={index} item={item} color={color} bullet={bullet} index={index} ordered={ordered} />
      ))}
    </Box>
  )
}

export {List}

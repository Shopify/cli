import {CommandWithText} from './CommandWithText.js'
import {LinkWithText} from './LinkWithText.js'
import {Box, Text} from 'ink'
import React from 'react'

interface CommandItem {
  text: string
  command: string
}

interface LinkItem {
  text: string
  link: {
    label: string
    url: string
  }
}

export type ListItem = string | CommandItem | LinkItem

interface Props {
  title: string
  items: ListItem[]
  ordered?: boolean
}

const DOT = '•'

const renderListItem = (item: ListItem) => {
  if (typeof item === 'string') {
    return <Text dimColor>{item}</Text>
  } else if ('command' in item) {
    return <CommandWithText text={item.text} command={item.command} />
  } else {
    return <LinkWithText text={item.text} link={item.link} />
  }
}

/**
 * `List` displays an unordered or ordered list with text aligned with the bullet point
 * and wrapped to the container width.
 * @param {React.PropsWithChildren<Props>} props
 * @returns {JSX.Element}
 */
const List: React.FC<Props> = ({title, items, ordered = false}: React.PropsWithChildren<Props>): JSX.Element => {
  return (
    <Box flexDirection="column">
      <Text dimColor>{title}</Text>
      {items.map((item, index) => (
        <Box key={index}>
          <Box>
            <Text dimColor>{`  ${ordered ? `${index}.` : DOT}`}</Text>
          </Box>

          <Box flexGrow={1} marginLeft={1}>
            {renderListItem(item)}
          </Box>
        </Box>
      ))}
    </Box>
  )
}

export {List}

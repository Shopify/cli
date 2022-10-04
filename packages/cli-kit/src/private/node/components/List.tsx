import {Command} from './Command.js'
import {Link} from './Link.js'
import {Box, Text} from 'ink'
import React from 'react'

interface CommandItem {
  command: string
}

interface LinkItem {
  link: {
    label: string
    url: string
  }
}

export type ListItem = string | CommandItem | LinkItem | ListItem[]

interface Props {
  title: string
  items: ListItem[]
  ordered?: boolean
}

const renderListItem = (item: ListItem): JSX.Element => {
  if (typeof item === 'string') {
    return <Text dimColor>{item}</Text>
  } else if ('command' in item) {
    return <Command command={item.command} />
  } else if ('link' in item) {
    return <Link {...item.link} />
  } else {
    return (
      <Text>
        {item.map((listItem, index) => (
          <Text key={index}>
            {renderListItem(listItem)}
            {index < item.length - 1 && <Text> </Text>}
          </Text>
        ))}
      </Text>
    )
  }
}

const DOT = '•'

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
            <Text dimColor>{`  ${ordered ? `${index + 1}.` : DOT}`}</Text>
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

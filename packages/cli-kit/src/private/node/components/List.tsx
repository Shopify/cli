import {Box, Text} from 'ink'
import React from 'react'

interface Props {
  title: string
  items: string[]
  ordered: boolean
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
            <Text dimColor>{`  ${ordered ? `${index}.` : DOT}`}</Text>
          </Box>

          <Box flexGrow={1} marginLeft={1}>
            <Text dimColor>{item}</Text>
          </Box>
        </Box>
      ))}
    </Box>
  )
}

export {List}

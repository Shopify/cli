import {Box, Text} from 'ink'
import React from 'react'

interface Props {
  title: string
  items: string[]
}

const DOT = '•'

const List: React.FC<Props> = ({title, items}) => {
  return (
    <Box flexDirection="column">
      <Text dimColor>{title}</Text>
      {items.map((item, index) => (
        <Box key={index}>
          <Box>
            <Text dimColor>{`  ${DOT}`}</Text>
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

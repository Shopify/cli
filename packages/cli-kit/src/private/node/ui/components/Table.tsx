import {List} from './List.js'
import {Box, Text} from 'ink'
import React from 'react'

export interface Props {
  table: {
    [header: string]: string[]
  }
}

const Table: React.FC<Props> = ({table}) => {
  const headers = Object.keys(table)
  const headerColumnWidth = Math.max(...headers.map((header) => header.length))

  return (
    <Box flexDirection="column" paddingY={1}>
      {headers.map((header, index) => (
        <Box key={index}>
          <Box width={headerColumnWidth + 1}>
            <Text>{header}:</Text>
          </Box>
          <Box flexGrow={1}>
            <List items={table[header]!} />
          </Box>
        </Box>
      ))}
    </Box>
  )
}

export default Table

import {List} from '../List.js'
import {capitalize} from '../../../../../public/common/string.js'
import {Box, Text} from 'ink'
import React, {FunctionComponent} from 'react'

export interface InfoTableProps {
  table: {
    [header: string]: string[]
  }
}

const InfoTable: FunctionComponent<InfoTableProps> = ({table}) => {
  const headers = Object.keys(table)
  const headerColumnWidth = Math.max(...headers.map((header) => header.length))

  return (
    <Box flexDirection="column">
      {headers.map((header, index) => (
        <Box key={index} marginBottom={index === headers.length - 1 ? 0 : 1}>
          <Box width={headerColumnWidth + 1}>
            <Text>{capitalize(header)}:</Text>
          </Box>
          <Box flexGrow={1}>
            <List items={table[header]!} />
          </Box>
        </Box>
      ))}
    </Box>
  )
}

export {InfoTable}

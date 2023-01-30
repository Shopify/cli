import {List} from '../List.js'
import {capitalize} from '../../../../../public/common/string.js'
import {Box, Text} from 'ink'
import React from 'react'

export interface Props {
  table: {
    [header: string]: string[]
  }
}

const InfoTable: React.FC<Props> = ({table}) => {
  const headers = Object.keys(table)
  const headerColumnWidth = Math.max(...headers.map((header) => header.length))

  return (
    <Box flexDirection="column">
      {headers.map((header, index) => (
        <Box key={index}>
          <Box width={headerColumnWidth + 1}>
            <Text>{capitalize(header)}:</Text>
          </Box>
          <Box flexGrow={1}>
            {table[header]!.length === 1 ? <Text>{`    ${table[header]![0]}`}</Text> : <List items={table[header]!} />}
          </Box>
        </Box>
      ))}
    </Box>
  )
}

export default InfoTable

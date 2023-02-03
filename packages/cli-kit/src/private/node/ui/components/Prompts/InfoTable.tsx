import {List} from '../List.js'
import {capitalize} from '../../../../../public/common/string.js'
import {InlineToken, TokenItem} from '../TokenizedText.js'
import {Box, Text} from 'ink'
import React from 'react'

export interface Props {
  table: {
    [header: string]: TokenItem<InlineToken>[]
  }
}

const InfoTable: React.FC<Props> = ({table}) => {
  const headers = Object.keys(table)
  const headerColumnWidth = Math.max(...headers.map((header) => header.length))

  return (
    <Box flexDirection="column">
      {headers.map((header, index) => (
        <Box key={index} marginBottom={index === headers.length - 1 ? 0 : 1}>
          {header.length > 0 && (
            <Box width={headerColumnWidth + 1}>
              <Text>{capitalize(header)}:</Text>
            </Box>
          )}
          <Box marginLeft={header.length > 0 ? 2 : 0} flexGrow={1}>
            <List margin={false} items={table[header]!} />
          </Box>
        </Box>
      ))}
    </Box>
  )
}

export default InfoTable

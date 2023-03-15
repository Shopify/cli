import {List} from '../List.js'
import {capitalize} from '../../../../../public/common/string.js'
import {InlineToken, TokenItem} from '../TokenizedText.js'
import {Box, Text, TextProps} from 'ink'
import React, {FunctionComponent} from 'react'

type Items = TokenItem<InlineToken>[]

export interface InfoTableSection {
  color?: TextProps['color']
  header: string
  helperMessage?: string
  items: Items
}

export interface InfoTableProps {
  table:
    | {
        [header: string]: Items
      }
    | InfoTableSection[]
}

const InfoTable: FunctionComponent<InfoTableProps> = ({table}) => {
  const sections = Array.isArray(table)
    ? table
    : Object.keys(table).map((header) => ({header, items: table[header]!, color: undefined, helperMessage: undefined}))
  const headerColumnWidth = Math.max(...sections.map((section) => section.header.length))

  return (
    <Box flexDirection="column">
      {sections.map((section, index) => (
        <Box key={index} marginBottom={index === sections.length - 1 ? 0 : 1} flexDirection="column">
          <Box>
            {section.header.length > 0 && (
              <Box width={headerColumnWidth + 1}>
                <Text color={section.color}>{capitalize(section.header)}:</Text>
              </Box>
            )}
            <Box marginLeft={section.header.length > 0 ? 2 : 0} flexGrow={1}>
              <List margin={false} items={section.items} color={section.color} />
            </Box>
          </Box>
          {section.helperMessage ? (
            <Box marginTop={1}>
              <Text color={section.color}>{section.helperMessage}</Text>
            </Box>
          ) : null}
        </Box>
      ))}
    </Box>
  )
}

export {InfoTable}

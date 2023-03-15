import {List} from '../List.js'
import {capitalize} from '../../../../../public/common/string.js'
import {InlineToken, TokenItem} from '../TokenizedText.js'
import {Box, Text, TextProps} from 'ink'
import React, {FunctionComponent} from 'react'

type Items = TokenItem<InlineToken>[]

interface TableSection {
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
    | TableSection[]
}

const InfoTable: FunctionComponent<InfoTableProps> = ({table}) => {
  const sections = Array.isArray(table)
    ? table
    : Object.keys(table).map((header) => ({header, items: table[header]!, color: undefined, helperMessage: undefined}))
  const headerColumnWidth = Math.max(...sections.map((section) => section.header.length))

  return (
    <Box flexDirection="column">
      {sections.map((section, index) => (
        <Box key={index} marginBottom={index === sections.length - 1 ? 0 : 1}>
          {section.header.length > 0 && (
            <Box width={headerColumnWidth + 1} flexDirection="column">
              <Text color={section.color}>{capitalize(section.header)}:</Text>
              {section.helperMessage ? <Text color={section.color}>{section.helperMessage}</Text> : null}
            </Box>
          )}
          <Box marginLeft={sections.length > 0 ? 2 : 0} flexGrow={1}>
            <List margin={false} items={section.items} color={section.color} />
          </Box>
        </Box>
      ))}
    </Box>
  )
}

export {InfoTable}

import {CustomListItem, List} from '../List.js'
import {capitalize} from '../../../../../public/common/string.js'
import {InlineToken, TokenItem, TokenizedText} from '../TokenizedText.js'
import {Box, Text, TextProps} from 'ink'
import React, {FunctionComponent} from 'react'

type Items = (TokenItem<InlineToken> | CustomListItem)[]

export interface InfoTableSection {
  color?: TextProps['color']
  header: string
  bullet?: string
  helperText?: string
  items: Items
  emptyItemsText?: string
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
    : Object.keys(table).map((header) => ({
        header,
        items: table[header]!,
        color: undefined,
        helperText: undefined,
        bullet: undefined,
        emptyItemsText: undefined,
      }))

  const headerColumnWidth = Math.max(
    ...sections.map((section) => {
      return Math.max(
        ...section.header.split('\n').map((line) => {
          return line.length
        }),
      )
    }),
  )

  return (
    <Box flexDirection="column">
      {sections.map((section, index) => (
        <Box key={index} marginBottom={index === sections.length - 1 ? 0 : 1} flexDirection="column">
          {section.header.length > 0 && (
            <Box width={headerColumnWidth + 1}>
              <Text color={section.color} bold>
                {capitalize(section.header)}
              </Text>
            </Box>
          )}
          <Box flexGrow={1} flexDirection="column" gap={1}>
            {section.emptyItemsText && section.items.length === 0 ? (
              <Text color={section.color}>
                <TokenizedText item={{subdued: section.emptyItemsText}} />
              </Text>
            ) : (
              <List margin={false} items={section.items} color={section.color} bullet={section.bullet} />
            )}
            {section.helperText ? <Text color={section.color}>{section.helperText}</Text> : null}
          </Box>
        </Box>
      ))}
    </Box>
  )
}

export {InfoTable}

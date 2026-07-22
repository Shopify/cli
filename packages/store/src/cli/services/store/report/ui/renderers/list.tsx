import {Box, Text} from 'ink'
import React, {type Key, type ReactNode} from 'react'
import type {ComponentRenderProps} from '@json-render/ink'

export interface ListProps {
  items: string[]
  ordered?: boolean | null
  bulletChar?: string | null
  spacing?: number | null
}

const DEFAULT_BULLET = '•'
const DEFAULT_SPACING = 0

/** cli-kit's exact bullet/indent box model (`List.tsx:65-77`): 2-space indent, 1-space bullet gap. */
export function renderListRow(bulletText: string, content: ReactNode, key: Key): ReactNode {
  return (
    <Box key={key} marginLeft={2}>
      <Text>{bulletText}</Text>
      <Box flexGrow={1} marginLeft={1}>
        <Text>{content}</Text>
      </Box>
    </Box>
  )
}

export function ListRenderer({element}: ComponentRenderProps<ListProps>) {
  const {items, ordered, bulletChar, spacing} = element.props
  const bullet = bulletChar ?? DEFAULT_BULLET

  return (
    <Box flexDirection="column" gap={spacing ?? DEFAULT_SPACING}>
      {items.map((item, index) => renderListRow(ordered ? `${index + 1}.` : bullet, item, `${index}:${item}`))}
    </Box>
  )
}

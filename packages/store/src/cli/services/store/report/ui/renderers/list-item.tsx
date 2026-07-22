import {Box, Text} from 'ink'
import React from 'react'
import type {ComponentRenderProps} from '@json-render/ink'

export interface ListItemProps {
  title: string
  subtitle?: string | null
  leading?: string | null
  trailing?: string | null
}

/** Same `marginLeft={2}` indent as List's rows, so a bare ListItem lines up with List's bullets. */
export function ListItemRenderer({element}: ComponentRenderProps<ListItemProps>) {
  const {title, subtitle, leading, trailing} = element.props

  return (
    <Box marginLeft={2} justifyContent="space-between">
      <Box gap={1}>
        {leading ? <Text dimColor>{leading}</Text> : null}
        <Box flexDirection="column">
          <Text bold>{title}</Text>
          {subtitle ? <Text dimColor>{subtitle}</Text> : null}
        </Box>
      </Box>
      {trailing ? <Text dimColor>{trailing}</Text> : null}
    </Box>
  )
}

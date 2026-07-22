import {safeColor} from './safe-props.js'
import {Box, Text} from 'ink'
import React from 'react'
import type {ComponentRenderProps} from '@json-render/ink'

export interface CardProps {
  title?: string | null
  backgroundColor?: string | null
  padding?: number | null
}

const DEFAULT_PADDING = 1

/**
 * Reuses Banner's round-border-with-inset-title mechanic (`Banner.tsx:73-86`) instead of a filled
 * background and a separate title row. Unlike Banner, Card carries no semantic `type`, so no color
 * is forced on the border, and `backgroundColor` is only applied when the model explicitly sets it
 * (cli-kit never imposes one, to respect the user's terminal theme).
 */
export function CardRenderer({element, children}: ComponentRenderProps<CardProps>) {
  const {title, backgroundColor, padding} = element.props

  return (
    <Box borderStyle="round" flexDirection="column" backgroundColor={safeColor(backgroundColor)}>
      {title ? (
        <Box marginTop={-1} marginLeft={1}>
          <Text>{` ${title} `}</Text>
        </Box>
      ) : null}
      <Box flexDirection="column" padding={padding ?? DEFAULT_PADDING}>
        {children}
      </Box>
    </Box>
  )
}

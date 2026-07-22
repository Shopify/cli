import {Box, Text} from 'ink'
import React from 'react'
import type {ComponentRenderProps} from '@json-render/ink'

type StatusLineStatus = 'info' | 'success' | 'warning' | 'error'

export interface StatusLineProps {
  text: string
  status?: StatusLineStatus | null
  icon?: string | null
}

interface StatusStyle {
  icon?: string
  color?: string
  bold?: boolean
}

/**
 * `success`/`error` reuse cli-kit's own default icons (`successIcon()`='✔' green,
 * `failIcon()`=bold+redBright '✖' — `output.ts:86-91`). cli-kit has no default icon convention for
 * `warning`/`info`, so those fall back to colored text with no glyph unless the model supplies one.
 */
const STATUS_STYLES: Record<StatusLineStatus, StatusStyle> = {
  info: {color: 'blue'},
  success: {icon: '✔', color: 'green'},
  warning: {color: 'yellow'},
  error: {icon: '✖', color: 'redBright', bold: true},
}

export function StatusLineRenderer({element}: ComponentRenderProps<StatusLineProps>) {
  const {text, status, icon} = element.props
  const style = status ? STATUS_STYLES[status] : undefined
  const resolvedIcon = icon ?? style?.icon

  return (
    <Box gap={1}>
      {resolvedIcon ? (
        <Text color={style?.color} bold={style?.bold}>
          {resolvedIcon}
        </Text>
      ) : null}
      <Text color={style?.color} bold={style?.bold}>
        {text}
      </Text>
    </Box>
  )
}

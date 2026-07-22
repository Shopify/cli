import {Box, Text} from 'ink'
import React, {type ReactNode} from 'react'
import type {ComponentRenderProps} from '@json-render/ink'

type CalloutType = 'info' | 'warning' | 'tip' | 'important'

export interface CalloutProps {
  type?: CalloutType | null
  title?: string | null
  content: string
}

/**
 * `info`/`warning` reuse the inline-token colors (`TokenizedText.tsx:236-239`). `tip`/`important`
 * have no cli-kit precedent and are extrapolated — see the restyle spec's risks/opens.
 */
export const CALLOUT_BORDER_COLORS: Record<CalloutType, string> = {
  info: 'blue',
  warning: 'yellow',
  tip: 'green',
  important: 'magenta',
}

const DEFAULT_TYPE: CalloutType = 'info'

interface LeftBarBoxProps {
  borderColor?: string
  children?: ReactNode
}

/** The left-border-bar shape shared by Callout and Markdown's blockquote rendering. */
export function LeftBarBox({borderColor, children}: LeftBarBoxProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="bold"
      borderLeft
      borderRight={false}
      borderTop={false}
      borderBottom={false}
      borderColor={borderColor}
      paddingLeft={1}
    >
      {children}
    </Box>
  )
}

export function CalloutRenderer({element}: ComponentRenderProps<CalloutProps>) {
  const {type, title, content} = element.props
  const borderColor = CALLOUT_BORDER_COLORS[type ?? DEFAULT_TYPE]

  return (
    <LeftBarBox borderColor={borderColor}>
      {title ? <Text bold>{title}</Text> : null}
      <Text>{content}</Text>
    </LeftBarBox>
  )
}

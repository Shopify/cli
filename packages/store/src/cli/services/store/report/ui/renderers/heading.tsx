import {safeColor} from './safe-props.js'
import {Text} from 'ink'
import React, {type ReactNode} from 'react'
import type {ComponentRenderProps} from '@json-render/ink'

export interface HeadingProps {
  text: string
  level?: 'h1' | 'h2' | 'h3' | 'h4' | null
  color?: string | null
}

type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4'

interface HeadingStyle {
  bold?: boolean
  underline?: boolean
  dimColor?: boolean
}

/** cli-kit only defines two heading tiers (`content-tokens.ts:113-122`); h3/h4 extend that scheme. */
export const HEADING_STYLES: Record<HeadingLevel, HeadingStyle> = {
  h1: {bold: true, underline: true},
  h2: {underline: true},
  h3: {bold: true},
  h4: {dimColor: true},
}

const DEFAULT_LEVEL: HeadingLevel = 'h2'

export function renderHeadingText(text: ReactNode, level: HeadingLevel, color?: string, key?: React.Key) {
  return (
    <Text key={key} {...HEADING_STYLES[level]} color={safeColor(color)}>
      {text}
    </Text>
  )
}

export function HeadingRenderer({element}: ComponentRenderProps<HeadingProps>) {
  const {text, level, color} = element.props
  return renderHeadingText(text, level ?? DEFAULT_LEVEL, color ?? undefined)
}

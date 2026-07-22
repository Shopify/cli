import {safeColor} from './safe-props.js'
import {Text} from 'ink'
import React from 'react'
import type {ComponentRenderProps} from '@json-render/ink'

export interface DividerProps {
  character?: string | null
  color?: string | null
  dimColor?: boolean | null
  title?: string | null
  width?: number | null
}

const DEFAULT_CHARACTER = '─'
const DEFAULT_WIDTH = 40
const LEFT_RULE_WIDTH = 2

/** Reuses cli-kit Banner's inset-title dash rule (`Banner.tsx:99-104`) instead of stock's centered title. */
export function DividerRenderer({element}: ComponentRenderProps<DividerProps>) {
  const {character, color, dimColor, title, width} = element.props
  const char = Array.from(character ?? DEFAULT_CHARACTER)[0] ?? DEFAULT_CHARACTER
  const totalWidth = width ?? DEFAULT_WIDTH
  const resolvedColor = safeColor(color)
  const resolvedDimColor = dimColor ?? undefined

  if (!title) {
    return (
      <Text color={resolvedColor} dimColor={resolvedDimColor}>
        {char.repeat(totalWidth)}
      </Text>
    )
  }

  const label = ` ${title} `
  const rightWidth = Math.max(0, totalWidth - LEFT_RULE_WIDTH - label.length)

  return (
    <Text color={resolvedColor} dimColor={resolvedDimColor}>
      {char.repeat(LEFT_RULE_WIDTH)}
      {label}
      {char.repeat(rightWidth)}
    </Text>
  )
}

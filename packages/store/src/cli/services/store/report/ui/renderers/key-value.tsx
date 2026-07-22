import {safeColor} from './safe-props.js'
import {Box, Text} from 'ink'
import React from 'react'
import type {ComponentRenderProps} from '@json-render/ink'

export interface KeyValueProps {
  label: string
  value: string | number | string[]
  labelColor?: string | null
  separator?: string | null
}

const DEFAULT_SEPARATOR = ':'
const MISSING_VALUE = '—'

function coerceToString(value: KeyValueProps['value']): string {
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'number') return value.toLocaleString()
  return value
}

/** Label is dim (`Subdued.tsx:12`'s convention) unless the model explicitly sets `labelColor`. */
export function KeyValueRenderer({element}: ComponentRenderProps<KeyValueProps>) {
  const {label, value, labelColor, separator} = element.props
  const color = safeColor(labelColor)

  return (
    <Box gap={1}>
      <Text color={color} dimColor={!labelColor}>
        {label}
        {separator ?? DEFAULT_SEPARATOR}
      </Text>
      <Text>{coerceToString(value) || MISSING_VALUE}</Text>
    </Box>
  )
}

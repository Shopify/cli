import {safeColor} from './safe-props.js'
import {Box, Text} from 'ink'
import React from 'react'
import type {ComponentRenderProps} from '@json-render/ink'

export interface SparklineProps {
  data: number[]
  width?: number | null
  color?: string | null
  label?: string | null
  min?: number | null
  max?: number | null
}

/** Same block-shade vocabulary as `LoadingBar.tsx`'s progress fill. */
const SHADES = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']

function shadeFor(value: number, min: number, max: number): string {
  if (max <= min) return SHADES[0]!
  const ratio = (value - min) / (max - min)
  const index = Math.min(SHADES.length - 1, Math.max(0, Math.round(ratio * (SHADES.length - 1))))
  return SHADES[index]!
}

/** Resamples down to `width` points, same nearest-index method the stock renderer uses. */
function resample(data: number[], width: number): number[] {
  if (width >= data.length) return data
  return Array.from({length: width}, (_unused, index) => {
    const sourceIndex = width === 1 ? 0 : Math.round((index / (width - 1)) * (data.length - 1))
    return data[sourceIndex]!
  })
}

/** Stock renderer hardcoded `color` to `green`; that forced default is dropped here. */
export function SparklineRenderer({element}: ComponentRenderProps<SparklineProps>) {
  const {data, width, color, label, min, max} = element.props
  if (data.length === 0) {
    return label ? <Text dimColor>{label}: (no data)</Text> : null
  }

  const resolvedMin = min ?? Math.min(...data)
  const resolvedMax = max ?? Math.max(...data)
  const sampled = resample(data, width ?? data.length)
  const line = sampled.map((value) => shadeFor(value, resolvedMin, resolvedMax)).join('')

  return (
    <Box gap={1}>
      {label ? <Text dimColor>{label}</Text> : null}
      <Text color={safeColor(color)}>{line}</Text>
    </Box>
  )
}

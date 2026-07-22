import {safeColor} from './safe-props.js'
import {twoThirdsWidth} from './terminal-width.js'
import {Box, Text, useStdout} from 'ink'
import React from 'react'
import type {ComponentRenderProps} from '@json-render/ink'

export interface BarChartDatum {
  label: string
  value: number
  color?: string | null
}

export interface BarChartProps {
  data: BarChartDatum[]
  width?: number | null
  showValues?: boolean | null
  showPercentage?: boolean | null
}

const BAR_CHAR = '█'
const MAX_DEFAULT_WIDTH = 40

/** Stock renderer hardcoded `green` for every bar and dimmed every label; both are dropped here. */
function barLength(value: number, max: number, width: number): number {
  if (max <= 0) return 0
  return Math.round((value / max) * width)
}

export function BarChartRenderer({element}: ComponentRenderProps<BarChartProps>) {
  const {data, width, showValues, showPercentage} = element.props
  const {stdout} = useStdout()
  if (data.length === 0) return null

  const barWidth = width ?? Math.min(twoThirdsWidth(stdout?.columns), MAX_DEFAULT_WIDTH)
  const max = Math.max(...data.map((datum) => datum.value), 0)
  const total = data.reduce((sum, datum) => sum + datum.value, 0)
  const labelWidth = Math.max(...data.map((datum) => datum.label.length), 0)

  return (
    <Box flexDirection="column">
      {data.map((datum) => {
        const length = barLength(datum.value, max, barWidth)
        const percentage = total > 0 ? Math.round((datum.value / total) * 100) : 0

        return (
          <Box key={datum.label} gap={1}>
            <Box width={labelWidth}>
              <Text dimColor>{datum.label}</Text>
            </Box>
            <Text color={safeColor(datum.color)}>{BAR_CHAR.repeat(length)}</Text>
            {showValues ? <Text dimColor>{datum.value}</Text> : null}
            {showPercentage ? <Text dimColor>{percentage}%</Text> : null}
          </Box>
        )
      })}
    </Box>
  )
}

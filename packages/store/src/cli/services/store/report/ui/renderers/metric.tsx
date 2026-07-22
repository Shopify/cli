import {Box, Text} from 'ink'
import React from 'react'
import type {ComponentRenderProps} from '@json-render/ink'

type Trend = 'up' | 'down' | 'neutral'

export interface MetricProps {
  label: string
  value: string
  detail?: string | null
  trend?: Trend | null
}

interface TrendStyle {
  prefix: string
  color?: string
  dimColor?: boolean
}

/** `neutral` uses `dimColor` (the palette's de-emphasis idiom) rather than a named gray hue. */
const TREND_STYLES: Record<Trend, TrendStyle> = {
  up: {prefix: '+', color: 'green'},
  down: {prefix: '', color: 'red'},
  neutral: {prefix: '~', dimColor: true},
}

export function MetricRenderer({element}: ComponentRenderProps<MetricProps>) {
  const {label, value, detail, trend} = element.props
  const trendStyle = trend ? TREND_STYLES[trend] : undefined

  return (
    <Box flexDirection="column">
      <Text dimColor>{label}</Text>
      <Box gap={1}>
        <Text bold>{value}</Text>
        {trendStyle && detail ? (
          <Text color={trendStyle.color} dimColor={trendStyle.dimColor}>
            {trendStyle.prefix}
            {detail}
          </Text>
        ) : null}
      </Box>
      {!trendStyle && detail ? <Text dimColor>{detail}</Text> : null}
    </Box>
  )
}

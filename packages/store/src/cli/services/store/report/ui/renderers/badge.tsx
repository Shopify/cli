import {Text} from 'ink'
import React from 'react'
import type {ComponentRenderProps} from '@json-render/ink'

type BadgeVariant = 'default' | 'info' | 'success' | 'warning' | 'error'

export interface BadgeProps {
  label: string
  variant?: BadgeVariant | null
}

interface BadgeStyle {
  color?: string
  bold?: boolean
}

/**
 * `default`/`info`/`success`/`warning` reuse `TokenizedText`'s plain (non-bold) inline colors
 * (`TokenizedText.tsx:236-239`). `error` matches `failIcon()`/`ErrorContentToken`'s bold+redBright.
 */
const BADGE_STYLES: Record<BadgeVariant, BadgeStyle> = {
  default: {},
  info: {color: 'blue'},
  success: {color: 'green'},
  warning: {color: 'yellow'},
  error: {color: 'redBright', bold: true},
}

const DEFAULT_VARIANT: BadgeVariant = 'default'

export function BadgeRenderer({element}: ComponentRenderProps<BadgeProps>) {
  const {label, variant} = element.props
  const style = BADGE_STYLES[variant ?? DEFAULT_VARIANT]

  return (
    <Text color={style.color} bold={style.bold}>
      [{label}]
    </Text>
  )
}

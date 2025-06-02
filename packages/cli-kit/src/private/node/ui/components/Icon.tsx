import {Text} from 'ink'
import React, {FunctionComponent} from 'react'

interface IconProps {
  type: 'success' | 'fail' | 'warning' | 'info'
}

/**
 * `Icon` displays common status icons.
 */
const Icon: FunctionComponent<IconProps> = ({type}): JSX.Element => {
  const iconMap = {
    success: {symbol: '✓', color: 'green' as const},
    fail: {symbol: '✗', color: 'red' as const},
    warning: {symbol: '⚠', color: 'yellow' as const},
    info: {symbol: 'ℹ', color: 'blue' as const},
  }

  const {symbol, color} = iconMap[type]

  return <Text color={color}>{symbol}</Text>
}

export {Icon}

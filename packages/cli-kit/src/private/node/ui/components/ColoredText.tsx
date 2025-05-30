import {Text} from 'ink'
import React, {FunctionComponent} from 'react'

type InkColor = 'green' | 'yellow' | 'cyan' | 'magenta' | 'gray' | 'blue' | 'red' | 'white' | 'black'

interface ColoredTextProps {
  text: string
  color: InkColor
}

/**
 * `ColoredText` displays text in the specified color.
 */
const ColoredText: FunctionComponent<ColoredTextProps> = ({text, color}): JSX.Element => {
  return <Text color={color}>{text}</Text>
}

export {ColoredText}
export type {InkColor}

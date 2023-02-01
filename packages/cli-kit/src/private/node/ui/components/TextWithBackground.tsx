import useLayout from '../hooks/use-layout.js'
import {Box, Text} from 'ink'
import React, {useCallback} from 'react'
import chalk, {ForegroundColor} from 'chalk'

interface TopBottomPaddingProps {
  padding: number
  color?: ForegroundColor
  width: number
  inverse?: boolean
}

const TopBottomPadding: React.FC<TopBottomPaddingProps> = ({padding, color, width, inverse}) => {
  return (
    <>
      {[...Array(padding).keys()].map((index) => (
        <Text key={index} backgroundColor={color} inverse={inverse}>
          {' '.repeat(width)}
        </Text>
      ))}
    </>
  )
}

interface Props {
  text: string
  backgroundColor?: ForegroundColor
  inverse?: boolean
  padding?: number
  paddingX?: number
  paddingY?: number
}

const TextWithBackground: React.FC<Props> = ({backgroundColor, inverse, padding, paddingX, paddingY, text}) => {
  const pY = (padding ? padding : paddingY) ?? 0
  const pX = (padding ? padding : paddingX) ?? 0
  const color = backgroundColor
  const {fullWidth: width} = useLayout()
  const textWidth = width - pX * 2
  let colorName: string

  if (color) {
    colorName = `bg${color[0]!.toUpperCase() + color.slice(1)}`
  } else if (inverse) {
    colorName = 'inverse'
  } else {
    throw new Error('Either backgroundColor or inverse must be set')
  }

  const textTransform = useCallback(
    (textToTransform: string) => {
      // split text into lines of width length
      const lines = textToTransform.match(new RegExp(`.{1,${textWidth}}`, 'g')) || []
      // pad each line to width length
      const paddedLines = lines.map((line) => `${' '.repeat(pX)}${line}${' '.repeat(pX)}`.padEnd(width, ' '))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (chalk as any)[colorName](paddedLines.join('\n'))
    },
    [colorName, pX, textWidth],
  )

  return (
    <Box flexDirection="column">
      {pY && <TopBottomPadding padding={pY} color={color} width={width} inverse={inverse} />}

      <Box flexGrow={1}>
        <Text>{textTransform(text)}</Text>
      </Box>

      {pY && <TopBottomPadding padding={pY} color={color} width={width} inverse={inverse} />}
    </Box>
  )
}

export default TextWithBackground

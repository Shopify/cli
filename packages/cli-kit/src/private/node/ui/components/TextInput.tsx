/* eslint-disable no-nested-ternary */
import useLayout from '../hooks/use-layout.js'
import * as React from 'react'
import {useEffect, useState} from 'react'
import {Box, Text, useInput} from 'ink'
import chalk from 'chalk'
import type {FC} from 'react'

interface Props {
  placeholder?: string
  value: string
  onChange: (value: string) => void
}

const TextInput: FC<Props> = ({value, placeholder = '', onChange}) => {
  const {width} = useLayout()
  const underline = new Array(width - 3).fill('▔')
  const [cursorOffset, setCursorOffset] = useState((value || '').length)

  // if the updated value is shorter than the last one we need to reset the cursor
  useEffect(() => {
    setCursorOffset((previousOffset) => {
      const newValue = value || ''

      if (previousOffset > newValue.length - 1) {
        return newValue.length
      }

      return previousOffset
    })
  }, [value])

  let renderedValue = value.length > 0 ? '' : chalk.inverse(' ')
  const renderedPlaceholder =
    placeholder.length > 0 ? chalk.inverse(placeholder[0]) + chalk.dim(placeholder.slice(1)) : undefined

  // render cursor
  renderedValue = value
    .split('')
    .map((char, index) => {
      if (index === cursorOffset) {
        return chalk.inverse(char)
      } else {
        return char
      }
    })
    .join('')

  if (value.length > 0 && cursorOffset === value.length) {
    renderedValue += chalk.inverse(' ')
  }

  useInput((input, key) => {
    if (
      key.upArrow ||
      key.downArrow ||
      (key.ctrl && input === 'c') ||
      key.tab ||
      (key.shift && key.tab) ||
      key.return
    ) {
      return
    }

    let nextCursorOffset = cursorOffset
    let nextValue = value

    if (key.leftArrow) {
      if (cursorOffset > 0) {
        nextCursorOffset--
      }
    } else if (key.rightArrow) {
      if (cursorOffset < value.length) {
        nextCursorOffset++
      }
    } else if (key.backspace || key.delete) {
      if (cursorOffset > 0) {
        nextValue = value.slice(0, cursorOffset - 1) + value.slice(cursorOffset, value.length)
        nextCursorOffset--
      }
    } else {
      nextValue = value.slice(0, cursorOffset) + input + value.slice(cursorOffset, value.length)
      nextCursorOffset += input.length
    }

    setCursorOffset(nextCursorOffset)

    if (nextValue !== value) {
      onChange(nextValue)
    }
  })

  return (
    <Box flexDirection="column" width={width}>
      <Box>
        <Box marginRight={2}>
          <Text color="cyan">{`>`}</Text>
        </Box>
        <Text color="cyan">
          {placeholder ? (value.length > 0 ? renderedValue : renderedPlaceholder) : renderedValue}
        </Text>
      </Box>
      <Box marginLeft={3}>
        <Text color="cyan">{underline}</Text>
      </Box>
    </Box>
  )
}

export {TextInput}

/* eslint-disable no-nested-ternary */
import {shouldDisplayColors} from '../../../../public/node/output.js'
import React, {useEffect, useState} from 'react'
import {Text, useInput} from 'ink'
import chalk from 'chalk'
import figures from 'figures'
import type {FunctionComponent} from 'react'

interface TextInputProps {
  defaultValue?: string
  value: string
  onChange: (value: string) => void
  color?: string
  password?: boolean
  focus?: boolean
  placeholder?: string
  noColor?: boolean
}

const TextInput: FunctionComponent<TextInputProps> = ({
  value: originalValue,
  defaultValue = '',
  onChange,
  placeholder = '',
  noColor = !shouldDisplayColors(),
  color = noColor ? undefined : 'cyan',
  password = false,
  focus = true,
}: TextInputProps) => {
  const [cursorOffset, setCursorOffset] = useState((originalValue || '').length)

  // if the updated value is shorter than the last one we need to reset the cursor
  useEffect(() => {
    setCursorOffset((previousOffset) => {
      const newValue = originalValue || ''

      if (previousOffset > newValue.length - 1) {
        return newValue.length
      }

      return previousOffset
    })
  }, [originalValue])

  const value = password ? '*'.repeat(originalValue.length) : originalValue
  let renderedValue

  const renderPlaceholder = (value: string) => {
    return chalk.inverse(value[0]) + chalk.dim(value.slice(1))
  }

  const cursorChar = figures.square
  const defaultCursor = <Text backgroundColor={color}>{cursorChar}</Text>

  const placeholderText = defaultValue.length > 0 ? defaultValue : placeholder.length > 0 ? placeholder : ''

  const renderedPlaceholder = placeholderText.length > 0 ? renderPlaceholder(placeholderText) : defaultCursor

  // render cursor
  renderedValue = value
    .split('')
    .map((char, index) => {
      if (index === cursorOffset) {
        return noColor ? cursorChar : chalk.inverse(char)
      } else {
        return char
      }
    })
    .join('')

  if (cursorOffset === value.length) {
    renderedValue = (
      <Text>
        {renderedValue}
        {defaultCursor}
      </Text>
    )
  }

  useInput(
    (input, key) => {
      if (key.upArrow || key.downArrow || (key.ctrl && input === 'c') || (key.shift && key.tab) || key.return) {
        return
      } else if (key.tab) {
        if (originalValue.length === 0 && placeholderText) {
          onChange(placeholderText)
          setCursorOffset(placeholderText.length)
          return
        }
      }

      let nextCursorOffset = cursorOffset
      let nextValue = originalValue

      if (key.leftArrow) {
        if (cursorOffset > 0) {
          nextCursorOffset--
        }
      } else if (key.rightArrow) {
        if (cursorOffset < originalValue.length) {
          nextCursorOffset++
        }
      } else if (key.backspace || key.delete) {
        if (cursorOffset > 0) {
          nextValue = originalValue.slice(0, cursorOffset - 1) + originalValue.slice(cursorOffset, originalValue.length)
          nextCursorOffset--
        }
      } else {
        nextValue =
          originalValue.slice(0, cursorOffset) + input + originalValue.slice(cursorOffset, originalValue.length)
        nextCursorOffset += input.length
      }

      setCursorOffset(nextCursorOffset)

      if (nextValue !== originalValue) {
        onChange(nextValue)
      }
    },
    {isActive: focus},
  )

  return <Text color={color}>{value.length > 0 ? renderedValue : renderedPlaceholder}</Text>
}

export {TextInput}

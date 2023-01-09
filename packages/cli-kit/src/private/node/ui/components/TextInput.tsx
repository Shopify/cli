/* eslint-disable no-nested-ternary */
import * as React from 'react'
import {useEffect, useState} from 'react'
import {Text, useInput} from 'ink'
import chalk from 'chalk'
import type {FC} from 'react'

interface Props {
  placeholder?: string
  value: string
  onChange: (value: string) => void
  color?: string
  password?: boolean
}

const TextInput: FC<Props> = ({value: originalValue, placeholder = '', onChange, color = 'cyan', password = false}) => {
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

  if (cursorOffset === value.length) {
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
      nextValue = originalValue.slice(0, cursorOffset) + input + originalValue.slice(cursorOffset, originalValue.length)
      nextCursorOffset += input.length
    }

    setCursorOffset(nextCursorOffset)

    if (nextValue !== originalValue) {
      onChange(nextValue)
    }
  })

  return (
    <Text color={color}>{placeholder ? (value.length > 0 ? renderedValue : renderedPlaceholder) : renderedValue}</Text>
  )
}

export {TextInput}

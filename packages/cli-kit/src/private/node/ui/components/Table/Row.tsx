import ScalarDict from './ScalarDict.js'
import {Column} from './Column.js'
import {unstyled} from '../../../../../public/node/output.js'
import {Box, Text} from 'ink'
import React from 'react'

interface RowProps<T extends ScalarDict> {
  fillerChar: string
  rowKey: string
  data: Partial<T>
  columns: Column<T>[]
  ignoreColumnColor?: boolean
}

function join<T, TI>(elements: T[], separator: (index: number) => TI): (T | TI)[] {
  return elements.reduce<(T | TI)[]>((elements, element, index) => {
    if (elements.length === 0) {
      return [element]
    }
    return [...elements, separator(index), element]
  }, [])
}

const Row = <T extends ScalarDict>({rowKey, columns, data, fillerChar, ignoreColumnColor}: RowProps<T>) => {
  return (
    <Box flexDirection="row">
      {...join(
        columns.map((column) => {
          const content = data[column.name]
          const key = `${rowKey}-cell-${column.name.toString()}`
          const marginRight = column.width - unstyled(String(content ?? '')).length

          return (
            <Text key={key} color={ignoreColumnColor ? undefined : column.color}>
              {content}
              {fillerChar.repeat(marginRight)}
            </Text>
          )
        }),

        (index) => {
          const key = `${rowKey}-horizontal-separator-${index}`
          return <Text key={key}>{'  '}</Text>
        },
      )}
    </Box>
  )
}

export {Row}

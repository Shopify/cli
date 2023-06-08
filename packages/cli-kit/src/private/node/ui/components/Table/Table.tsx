import ScalarDict from './ScalarDict.js'
import {Row} from './Row.js'
import {unstyled} from '../../../../../public/node/output.js'
import React from 'react'
import {Box} from 'ink'
import {ForegroundColor} from 'chalk'

export type TableColumn<T> = {
  [column in keyof T]: {header?: string; color?: ForegroundColor | 'dim'}
}

export interface TableProps<T extends ScalarDict> {
  rows: T[]
  columns: TableColumn<T>
}

// eslint-disable-next-line react/function-component-definition
function Table<T extends ScalarDict>({rows, columns: columnsConfiguration}: TableProps<T>) {
  const columns = Object.entries(columnsConfiguration).map(([key, {header, color}]) => {
    const headerWidth = String(header || key).length
    const columnWidths = rows.map((row) => {
      const value = row[key]

      if (value === undefined || value === null) {
        return 0
      }

      return unstyled(String(value)).length
    })

    return {
      name: key,
      width: Math.max(...columnWidths, headerWidth),
      color,
    }
  })
  const headings = Object.entries(columnsConfiguration).reduce(
    (headings, [column, {header}]) => ({...headings, [column]: header || column}),
    {},
  )

  return (
    <Box flexDirection="column">
      <Row rowKey="heading" fillerChar=" " columns={columns} data={headings} ignoreColumnColor />
      <Row rowKey="separator" fillerChar="─" columns={columns} data={{}} ignoreColumnColor />
      {rows.map((row, index) => {
        const key = `row-${index}`

        return (
          <Box flexDirection="column" key={key}>
            <Row rowKey={`data-${key}`} fillerChar=" " columns={columns} data={row} />
          </Box>
        )
      })}
    </Box>
  )
}

export {Table}

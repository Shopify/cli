import {Row} from './Row.js'
import ScalarDict from './ScalarDict.js'
import {Column} from './Column.js'
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

const COLUMN_GAP = 2

function tableColumns<T extends ScalarDict>({rows, columns: columnsConfiguration}: TableProps<T>): Column<T>[] {
  return Object.entries(columnsConfiguration).map(([key, {header, color}]) => {
    const headerWidth = String(header ?? key).length
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
}

/**
 * The width the table needs to show every cell on one line: the widest value or header of each column, plus the
 * gap between columns.
 *
 * @param props - The table's rows and columns.
 * @returns The width in characters.
 */
export function tableWidth<T extends ScalarDict>(props: TableProps<T>): number {
  const columns = tableColumns(props)
  const gaps = Math.max(columns.length - 1, 0) * COLUMN_GAP
  return columns.reduce((width, column) => width + column.width, gaps)
}

function Table<T extends ScalarDict>({rows, columns: columnsConfiguration}: TableProps<T>) {
  const columns = tableColumns({rows, columns: columnsConfiguration})
  const headings = Object.entries(columnsConfiguration).reduce(
    (headings, [column, {header}]) => ({...headings, [column]: header ?? column}),
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

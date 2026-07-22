import {safeColor} from './safe-props.js'
import {Box, Text} from 'ink'
import React from 'react'
import type {ComponentRenderProps} from '@json-render/ink'

type ColumnAlign = 'left' | 'center' | 'right'

export interface TableColumn {
  header: string
  key: string
  width?: number | null
  align?: ColumnAlign | null
}

export interface TableProps {
  columns: TableColumn[]
  rows: Record<string, string>[]
  borderStyle?: string | null
  backgroundColor?: string | null
  headerColor?: string | null
}

const COLUMN_GAP = '  '
const MISSING_VALUE = '—'

function padCell(text: string, width: number, align: ColumnAlign | null | undefined): string {
  const pad = Math.max(0, width - text.length)
  if (align === 'right') return ' '.repeat(pad) + text
  if (align === 'center') {
    const leftPad = Math.floor(pad / 2)
    return ' '.repeat(leftPad) + text + ' '.repeat(pad - leftPad)
  }
  return text + ' '.repeat(pad)
}

/**
 * cli-kit tables have no border box, a plain (non-bold) header, a `─` separator sized per column,
 * and a 2-space gap between columns (`Table/Table.tsx`, `Table/Row.tsx:43`). `borderStyle` and
 * `backgroundColor` are accepted by the schema but intentionally not honored here — see the restyle
 * spec's risks/opens — while `headerColor` is applied only when the model explicitly sets it.
 */
export function TableRenderer({element}: ComponentRenderProps<TableProps>) {
  const {columns, rows, headerColor} = element.props
  const columnWidths = columns.map(
    (column) =>
      column.width ??
      Math.max(
        column.header.length,
        // Width must match the rendered em-dash placeholder (see the render loop below), not the
        // raw empty string, so this mirrors that loop's `||` rather than using `??`.
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        ...rows.map((row) => (row[column.key] || MISSING_VALUE).length),
      ),
  )
  const headerColorValue = safeColor(headerColor)

  return (
    <Box flexDirection="column">
      <Box>
        {columns.map((column, index) => (
          <Text key={column.key} color={headerColorValue}>
            {index > 0 ? COLUMN_GAP : ''}
            {padCell(column.header, columnWidths[index]!, column.align)}
          </Text>
        ))}
      </Box>
      <Text>{columnWidths.map((width, index) => (index > 0 ? COLUMN_GAP : '') + '─'.repeat(width)).join('')}</Text>
      {rows.map((row, rowIndex) => (
        <Box key={rowIndex}>
          {columns.map((column, index) => (
            <Text key={column.key}>
              {index > 0 ? COLUMN_GAP : ''}
              {/* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- an empty
              string cell (not just a missing key) should also render as the em dash */}
              {padCell(row[column.key] || MISSING_VALUE, columnWidths[index]!, column.align)}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  )
}

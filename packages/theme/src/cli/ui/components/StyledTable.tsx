import {palette} from '../palette.js'
import {Box, Text, useStdout} from '@shopify/cli-kit/node/ink'
import {itemToString, unstyled} from '@shopify/cli-kit/node/output'
import {TokenItem, TokenizedText} from '@shopify/cli-kit/node/ui'
import React, {FunctionComponent} from 'react'

const GAP = 2
const MIN_COL = 8
const DEFAULT_RESERVED_WIDTH = 6

interface StyledCell {
  text: string
  color?: string
  bold?: boolean
}

export type Cell = string | StyledCell | TokenItem

function isStyledCell(cell: Cell): cell is StyledCell {
  return typeof cell === 'object' && cell !== null && !Array.isArray(cell) && 'text' in cell
}

export interface StyledTableProps {
  columns?: string[]
  rows: Cell[][]
  firstColumnSubdued?: boolean
  reservedWidth?: number
  maxWidth?: number
}

function cellText(cell: Cell): string {
  if (typeof cell === 'string') return itemToString(cell)
  if (isStyledCell(cell)) return cell.text
  return itemToString(cell)
}

function cellWidth(cell: Cell): number {
  return unstyled(cellText(cell)).length
}

function columnDefaultColor(isHeader: boolean, isFirstColumn: boolean, firstColumnSubdued: boolean): string {
  if (isHeader) return palette.header
  if (isFirstColumn && firstColumnSubdued) return palette.subdued
  return palette.text
}

function naturalColumnWidths(data: Cell[][]): number[] {
  return data.reduce<number[]>((acc, row) => {
    row.forEach((cell, index) => {
      acc[index] = Math.max(acc[index] ?? 0, cellWidth(cell))
    })
    return acc
  }, [])
}

// Fit the natural column widths within `available`. When they already fit, they
// are returned unchanged (wide-terminal path). Otherwise the single widest
// column is shrunk (never below MIN_COL) so overflow truncates instead of
// wrapping mid-word; the other columns keep their natural width.
function fittedColumnWidths(natural: number[], available: number): number[] {
  const gapsTotal = GAP * Math.max(0, natural.length - 1)
  if (natural.reduce((sum, width) => sum + width, 0) + gapsTotal <= available) {
    return natural
  }

  const widestIndex = natural.indexOf(Math.max(...natural))
  const otherWidths = natural.reduce((sum, width, index) => (index === widestIndex ? sum : sum + width), 0)
  const shrunk = Math.max(MIN_COL, available - gapsTotal - otherWidths)
  return natural.map((width, index) => (index === widestIndex ? shrunk : width))
}

function renderCellContent(cell: Cell, isHeader: boolean, defaultColor: string) {
  if (!isStyledCell(cell) && typeof cell !== 'string') {
    return <TokenizedText item={cell} />
  }
  const color = isStyledCell(cell) ? (cell.color ?? defaultColor) : defaultColor
  const bold = isStyledCell(cell) ? (cell.bold ?? isHeader) : isHeader
  return (
    <Text bold={bold} color={color} wrap="truncate-end">
      {cellText(cell)}
    </Text>
  )
}

const StyledTable: FunctionComponent<StyledTableProps> = ({
  columns,
  rows,
  firstColumnSubdued,
  reservedWidth = DEFAULT_RESERVED_WIDTH,
  maxWidth,
}) => {
  const {stdout} = useStdout()
  const terminalWidth = stdout?.columns ?? 80
  const available = (maxWidth ?? terminalWidth) - reservedWidth

  const hasHeader = Boolean(columns && columns.length > 0)
  const data: Cell[][] = hasHeader ? [columns as string[], ...rows] : rows
  const columnWidths = fittedColumnWidths(naturalColumnWidths(data), available)

  return (
    <Box flexDirection="column">
      {data.map((row, rowIndex) => {
        const isHeader = hasHeader && rowIndex === 0
        return (
          <Box key={rowIndex} flexDirection="row" gap={GAP}>
            {row.map((cell, columnIndex) => {
              const isFirstColumn = columnIndex === 0
              const defaultColor = columnDefaultColor(isHeader, isFirstColumn, Boolean(firstColumnSubdued))
              return (
                <Box key={columnIndex} width={columnWidths[columnIndex] ?? 0} flexShrink={isFirstColumn ? 0 : 1}>
                  {renderCellContent(cell, isHeader, defaultColor)}
                </Box>
              )
            })}
          </Box>
        )
      })}
    </Box>
  )
}

export {StyledTable}

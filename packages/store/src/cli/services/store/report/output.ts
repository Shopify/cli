import {outputContent, outputInfo, outputResult, outputToken} from '@shopify/cli-kit/node/output'
import {renderTable} from '@shopify/cli-kit/node/ui'
import type {ShopifyqlTableColumn, ShopifyqlTableData, StoreReportResult} from './types.js'

export type StoreReportOutputFormat = 'text' | 'json'

export function shapeStoreReportJson(result: StoreReportResult): unknown {
  return {
    store: result.store,
    apiVersion: result.apiVersion,
    question: result.question,
    api: result.api,
    query: result.query,
    rationale: result.rationale,
    result: result.result,
  }
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

function stringifyRow(row: {[key: string]: unknown}, columns: ShopifyqlTableColumn[]): {[key: string]: string} {
  return Object.fromEntries(columns.map((column) => [column.name, formatCellValue(row[column.name])]))
}

function renderShopifyqlTable(tableData: ShopifyqlTableData): void {
  if (tableData.rows.length === 0) {
    outputInfo('No data for this query.')
    return
  }

  renderTable({
    rows: tableData.rows.map((row) => stringifyRow(row, tableData.columns)),
    columns: Object.fromEntries(
      tableData.columns.map((column) => [column.name, {header: column.displayName || column.name}]),
    ),
  })
}

function renderAdminResult(data: unknown): void {
  if (data === null || data === undefined) {
    outputInfo('No data for this query.')
    return
  }

  outputResult(JSON.stringify(data, null, 2))
}

export function renderStoreReportResult(result: StoreReportResult, format: StoreReportOutputFormat): void {
  if (format === 'json') {
    outputResult(JSON.stringify(shapeStoreReportJson(result), null, 2))
    return
  }

  outputInfo(outputContent`${outputToken.gray(result.query)}`)

  if (result.api === 'shopifyql') {
    renderShopifyqlTable(result.result as ShopifyqlTableData)
  } else {
    renderAdminResult(result.result)
  }
}

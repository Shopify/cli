import {outputContent, outputInfo, outputResult, outputToken} from '@shopify/cli-kit/node/output'
import {renderTable} from '@shopify/cli-kit/node/ui'
import type {ReportQueryRecord, ShopifyqlTableColumn, ShopifyqlTableData, StoreReportResult} from './types.js'

export type StoreReportOutputFormat = 'text' | 'json'

export function shapeStoreReportJson(result: StoreReportResult): unknown {
  return {
    store: result.store,
    apiVersion: result.apiVersion,
    question: result.question,
    rationale: result.rationale,
    queries: result.queries,
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

function renderQueryRecord(record: ReportQueryRecord): void {
  outputInfo(outputContent`${outputToken.gray(record.query)}`)

  if (record.api === 'shopifyql') {
    renderShopifyqlTable(record.result as ShopifyqlTableData)
  } else {
    renderAdminResult(record.result)
  }
}

export function renderStoreReportResult(result: StoreReportResult, format: StoreReportOutputFormat): void {
  if (format === 'json') {
    outputResult(JSON.stringify(shapeStoreReportJson(result), null, 2))
    return
  }

  // The agent's summary is no longer streamed live in normal mode (it's routed to `outputDebug`,
  // visible only under `--verbose`), so we print `result.rationale` here as the headline answer,
  // followed by each query's results. Each query gets its own blank-line-separated section so a
  // compound answer's results don't run together.
  if (result.rationale.trim().length > 0) {
    outputInfo(result.rationale)
  }

  for (const record of result.queries) {
    outputInfo('')
    renderQueryRecord(record)
  }
}

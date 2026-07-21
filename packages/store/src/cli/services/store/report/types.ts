export type StoreReportApi = 'shopifyql' | 'admin'

export interface ShopifyqlTableColumn {
  name: string
  dataType: string
  displayName: string
}

export interface ShopifyqlTableData {
  columns: ShopifyqlTableColumn[]
  rows: {[key: string]: unknown}[]
}

/**
 * A query the agent successfully executed against the store during a run. The agent loop appends
 * one of these each time a tool call succeeds, in call order.
 */
export interface ReportQueryRecord {
  api: StoreReportApi
  query: string
  result: unknown
}

export interface StoreReportResult {
  store: string
  apiVersion: string
  question: string
  rationale: string
  queries: ReportQueryRecord[]
}

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
 * one of these each time a tool call succeeds; the LAST entry is treated as the ground-truth
 * answer that gets surfaced to the user (the model may run several exploratory queries first).
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
  api: StoreReportApi
  query: string
  rationale: string
  result: ShopifyqlTableData | unknown
}

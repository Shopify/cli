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

export interface ParsedReportQuery {
  api: StoreReportApi
  query: string
  rationale: string
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

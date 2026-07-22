import {STORE_QUERY_TOOL_NAMES} from './tools.js'

/**
 * Reports a phase-title change to whatever is displaying progress (the command's single cli-kit task
 * bar). `title` is plain text — the caller decides how to render it (e.g. wrapping it as a
 * `TokenizedString` for `renderSingleTask`'s `updateStatus`).
 */
export type ReportProgress = (title: string) => void

/**
 * The cli-kit `LoadingBar` already appends its own trailing " ..." to whatever title it's given (see
 * `SingleTask`/`LoadingBar`), so these titles intentionally omit a trailing ellipsis of their own —
 * adding one here would double up on-screen.
 */
export const REPORT_PROGRESS_TITLES = {
  analyzing: 'Analyzing your question',
  consultingDocs: 'Consulting Shopify docs',
  building: 'Building your report',
} as const

/** Builds the "querying your store" title with the correct singular/plural query count. */
export function queryingTitle(queryCount: number): string {
  return `Querying your store (${queryCount} ${queryCount === 1 ? 'query' : 'queries'})`
}

/** Whether a tool name is one of the store-query tools (as opposed to a dev-mcp docs tool). */
export function isStoreQueryTool(toolName: string): boolean {
  return (STORE_QUERY_TOOL_NAMES as ReadonlyArray<string>).includes(toolName)
}

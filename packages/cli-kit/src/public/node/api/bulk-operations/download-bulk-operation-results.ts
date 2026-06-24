import {fetch} from '../../http.js'
import {AbortError} from '../../error.js'

/**
 * Downloads the results of a completed bulk operation.
 *
 * @param url - The results URL returned by the Admin API.
 * @returns The raw JSONL results as a string.
 */
export async function downloadBulkOperationResults(url: string): Promise<string> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new AbortError(`Failed to download bulk operation results: ${response.statusText}`)
  }

  return response.text()
}

/**
 * Checks whether any line of a JSONL bulk operation result reports GraphQL user errors.
 *
 * Blank result files, such as a completed operation that matched nothing, are treated as having
 * no user errors instead of crashing the JSON parser.
 *
 * @param results - The raw JSONL results string.
 * @returns True if any result line reports user errors.
 */
export function resultsContainUserErrors(results: string): boolean {
  const lines = results
    .trim()
    .split('\n')
    .filter((line) => line.trim().length > 0)

  return lines.some((line) => {
    const parsed = JSON.parse(line)
    if (!parsed.data) return false
    const result = Object.values(parsed.data)[0] as {userErrors?: unknown[]} | undefined
    return result?.userErrors !== undefined && result.userErrors.length > 0
  })
}

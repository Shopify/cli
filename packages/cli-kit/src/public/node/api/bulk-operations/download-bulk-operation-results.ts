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

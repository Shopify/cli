import {fetch} from '@shopify/cli-kit/shared/node/http'
import {AbortError} from '@shopify/cli-kit/shared/node/error'

export async function downloadBulkOperationResults(url: string): Promise<string> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new AbortError(`Failed to download bulk operation results: ${response.statusText}`)
  }

  return response.text()
}

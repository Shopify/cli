import {extractMyshopifyHandle} from '@shopify/cli-kit/common/url'
import {formatJsonOutputTimestamp} from '@shopify/cli-kit/common/json-output-schema'
import {BugError} from '@shopify/cli-kit/node/error'
import type {BulkOperation} from '@shopify/cli-kit/node/api/bulk-operations'
import type {BulkOperationJson, ListedBulkOperationJson} from './types.js'

export function bulkOperationJsonContext(result: {store?: string; apiVersion?: string}) {
  const handle = extractMyshopifyHandle(result.store)
  return {storeDomain: handle ? `${handle}.myshopify.com` : null, apiVersion: result.apiVersion ?? null}
}

export function toBulkOperationJson(operation: BulkOperation): BulkOperationJson
export function toBulkOperationJson(operation: Omit<BulkOperation, 'type'>): ListedBulkOperationJson
export function toBulkOperationJson(
  operation: BulkOperation | Omit<BulkOperation, 'type'>,
): BulkOperationJson | ListedBulkOperationJson {
  if (typeof operation.objectCount === 'number' && !Number.isSafeInteger(operation.objectCount)) {
    throw new BugError("Shopify returned a bulk operation count that can't be represented exactly.")
  }

  return {
    gid: operation.id,
    ...('type' in operation ? {type: operation.type} : {}),
    status: operation.status,
    errorCode: operation.errorCode ?? null,
    createdAt: formatJsonOutputTimestamp(new Date(String(operation.createdAt))),
    completedAt: operation.completedAt ? formatJsonOutputTimestamp(new Date(String(operation.completedAt))) : null,
    objectCount: String(operation.objectCount),
    url: operation.url ?? null,
    partialDataUrl: operation.partialDataUrl ?? null,
  }
}

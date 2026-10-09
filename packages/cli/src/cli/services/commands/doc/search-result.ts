import {docSearchJsonOutputSchema} from './types.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'
import type {DocSearchServiceResult} from './search.js'

export function presentDocSearchResult(result: DocSearchServiceResult, format: 'json' | 'text'): void {
  if (format === 'text') {
    outputResult(result.body)
    return
  }

  if (result.status === 'invalid-response') {
    throw new AbortError('Search returned an invalid documentation response.')
  }
  outputResult(docSearchJsonOutputSchema.encode({results: result.results, pageInfo: result.pageInfo}))
}

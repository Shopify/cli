import {searchJsonOutputSchema, type SearchResult} from './types.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {openURL} from '@shopify/cli-kit/node/system'

export async function presentSearchResult(result: SearchResult, format: 'json' | 'text'): Promise<void> {
  if (format === 'json') {
    outputResult(searchJsonOutputSchema.encode(result))
  } else {
    await openURL(result.url)
  }
}

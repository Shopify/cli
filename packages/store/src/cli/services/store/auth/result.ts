import {storeAuthJsonOutputSchema, type StoreAuthResult} from './types.js'
import {outputCompleted, outputInfo, outputResult} from '@shopify/cli-kit/node/output'

type StoreAuthOutputFormat = 'text' | 'json'

function buildStoreAuthSuccessText(result: StoreAuthResult): {completed: string[]; info: string[]} {
  const displayName = result.associatedUser?.email ? ` as ${result.associatedUser.email}` : ''

  return {
    completed: ['Logged in.', `Authenticated${displayName} against ${result.store}.`],
    info: [
      '',
      'To verify that authentication worked, run:',
      `shopify store execute --store ${result.store} --query 'query { shop { name id } }'`,
    ],
  }
}

export function presentStoreAuthResult(result: StoreAuthResult, format: StoreAuthOutputFormat = 'text'): void {
  if (format === 'json') {
    outputResult(storeAuthJsonOutputSchema.encode(result))
    return
  }

  const text = buildStoreAuthSuccessText(result)
  text.completed.forEach((line) => outputCompleted(line))
  text.info.forEach((line) => outputInfo(line))
}

import {appLogSourcesJsonOutputSchema, type AppLogSourcesResult} from './types.js'
import {formatSection, outputResult} from '@shopify/cli-kit/node/output'

export function renderAppLogSourcesResult(result: AppLogSourcesResult, format: 'json' | 'text'): void {
  if (format === 'json') {
    outputResult(appLogSourcesJsonOutputSchema.encode(result))
    return
  }

  const sourcesByNamespace = new Map<string, string[]>()
  result.forEach(({source}) => {
    const tokens = source.split('.')

    if (tokens.length >= 2) {
      const sourceNamespace = tokens[0]!

      if (!sourcesByNamespace.has(sourceNamespace)) {
        sourcesByNamespace.set(sourceNamespace, [])
      }

      sourcesByNamespace.set(sourceNamespace, [...sourcesByNamespace.get(sourceNamespace)!, source])
    }
  })

  for (const [namespace, sources] of sourcesByNamespace) {
    outputResult(formatSection(namespace, sources.join('\n')))
  }
}

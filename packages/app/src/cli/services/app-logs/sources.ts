import {sourcesForApp} from './utils.js'
import {AppInterface} from '../../models/app/app.js'
import {formatSection, outputResult} from '@shopify/cli-kit/node/output'

export function sources(app: AppInterface) {
  const sources = sourcesForApp(app)
  const sourcesByNamespace = new Map<string, string[]>()
  sources.forEach((source) => {
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

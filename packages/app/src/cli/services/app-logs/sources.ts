import {AppInterface} from '../../models/app/app.js'
import {sourcesForApp} from '../../services/app-logs/utils.js'
import {formatSection, outputResult} from '@shopify/cli-kit/node/output'

export function sources(app: AppInterface) {
  const sources = sourcesForApp(app)
  const sourcesByNamespace = new Map<string, string[]>()
  sources.forEach((source) => {
    const tokens = source.split('.')

    if (tokens.length >= 2) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const sourceNamespace = tokens[0]!

      if (!sourcesByNamespace.has(sourceNamespace)) {
        sourcesByNamespace.set(sourceNamespace, [])
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      sourcesByNamespace.set(sourceNamespace, [...sourcesByNamespace.get(sourceNamespace)!, source])
    }
  })

  for (const [namespace, sources] of sourcesByNamespace) {
    outputResult(formatSection(namespace, sources.join('\n')))
  }
}

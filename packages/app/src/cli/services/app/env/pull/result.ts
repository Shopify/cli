import {appEnvPullJsonOutputSchema} from './types.js'
import {type PullEnvOutput} from '../pull.js'
import {diffLines} from 'diff'
import {OutputMessage, outputContent, outputToken, outputResult} from '@shopify/cli-kit/node/output'
// eslint-disable-next-line no-restricted-imports -- JSON file paths use native platform separators.
import {resolve} from 'node:path'

export function formatAppEnvPullResult(
  {result, previousContent}: PullEnvOutput,
  format: 'json' | 'text',
): OutputMessage {
  if (format === 'json') return appEnvPullJsonOutputSchema.encode({...result, path: resolve(result.path)})
  const {path, changed, content} = result
  if (!changed) return outputContent`No changes to ${outputToken.path(path)}`
  if (previousContent === null) {
    return outputContent`Created ${outputToken.path(path)}:

${content}
`
  }
  return outputContent`Updated ${outputToken.path(path)} to be:

${content}

Here's what changed:

${outputToken.linesDiff(diffLines(previousContent ?? '', content))}
  `
}

export function renderAppEnvPullResult(result: PullEnvOutput, format: 'json' | 'text'): void {
  outputResult(formatAppEnvPullResult(result, format))
}

import {appEnvPullJsonOutputSchema} from './types.js'
import {type PullEnvOutput} from '../pull.js'
import {diffLines} from 'diff'
import {OutputMessage, outputContent, outputToken, outputResult} from '@shopify/cli-kit/node/output'

export function formatAppEnvPullResult(
  {result, previousContent}: PullEnvOutput,
  format: 'json' | 'text',
): OutputMessage {
  if (format === 'json') return appEnvPullJsonOutputSchema.encode(result)
  const {path, status, content} = result
  if (status === 'unchanged') return outputContent`No changes to ${outputToken.path(path)}`
  if (status === 'created') {
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

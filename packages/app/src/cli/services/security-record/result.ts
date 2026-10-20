import {formatAppSecurityCommand, resolveAppSecurityCommands} from '../app-security-commands.js'
import {countLabel} from '../app-security-format.js'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import type {AppSecuritySelection} from '../app-security-selection.js'
import type {SecurityRecordResult} from '../security-record.js'

/** Presents a recorded document in the terminal. */
export function renderSecurityRecordResult(
  result: SecurityRecordResult,
  selection: AppSecuritySelection,
  path: string,
): void {
  const commands = resolveAppSecurityCommands(selection, path)
  renderSuccess({
    headline: 'Agent findings recorded.',
    body: [
      `Recorded ${countLabel(result.checks, 'check')} and ${countLabel(result.findings, 'finding')} in`,
      {filePath: result.path},
    ],
    nextSteps: [['Run', {command: formatAppSecurityCommand(commands.review)}, 'to see the results.']],
  })
}

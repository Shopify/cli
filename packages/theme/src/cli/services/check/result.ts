import {themeCheckJsonOutputSchema, type ThemeCheckResult} from './types.js'
import {formatSummary, renderOffensesText, sortOffenses, isExtendedWriteStream} from '../check.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo, renderSuccess} from '@shopify/cli-kit/node/ui'
import {type Offense, type Theme} from '@shopify/theme-check-node'

export function encodeThemeCheckResult(result: unknown): string {
  // Keep the legacy output option compact while encoding the agreed object contract.
  return JSON.stringify(JSON.parse(themeCheckJsonOutputSchema.encode(result)))
}

export function renderThemeCheckResult(
  {result, offenses, theme, valid}: {result: ThemeCheckResult; offenses: Offense[]; theme: Theme; valid?: boolean},
  outputFormat: string,
  path: string,
  environment?: string,
): void {
  const offensesByFile = sortOffenses(offenses)

  if (outputFormat === 'text') {
    renderOffensesText(offensesByFile, path, theme, environment)

    // Use renderSuccess when theres no offenses
    const render = offenses.length ? renderInfo : renderSuccess

    render({
      headline: environment ? `[${environment}] Theme Check Summary.` : 'Theme Check Summary.',
      body: formatSummary(offenses, offensesByFile, theme),
    })
  }

  if (outputFormat === 'json') {
    /**
     * Workaround:
     * Force stdout to be blocking so that the JSON output is not broken when piped to another process.
     * ie: ` | jq .`
     * It turns out that console.log is technically asynchronous, and when we call process.exit(),
     * node doesn't wait on all the output being sent to stdout and instead closes the process immediately
     *
     * https://github.com/pnp/cli-microsoft365/issues/1266#issuecomment-727254264
     *
     */
    const stdout = process.stdout
    if (isExtendedWriteStream(stdout)) {
      stdout._handle.setBlocking(true)
    }

    outputResult(encodeThemeCheckResult(valid === undefined ? result : {files: result, valid}))
  }
}

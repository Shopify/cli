/* eslint-disable no-console -- Adapts the upstream config validator's direct console output. */
import {commandEventOutputMode, emitCommandEvent} from '@shopify/cli-kit/node/command-events'
import {AsyncLocalStorage} from 'node:async_hooks'
import {format} from 'node:util'

const customChecksDisabledWarning =
  'Custom Theme Checks are disabled. Explicit authorization is required to execute custom check JavaScript.'

interface ThemeCheckDiagnosticContext {
  json: boolean
  onCustomChecksDisabled?: () => void
}

const themeCheckDiagnostics = new AsyncLocalStorage<ThemeCheckDiagnosticContext>()
let activeChecks = 0
let originalConsoleError: typeof console.error

// Theme Check's config validator bypasses its logger and calls console.error directly.
// Keep interception scoped to these async calls, including overlapping environments.
export async function withThemeCheckDiagnostics<T>(
  run: () => Promise<T>,
  options: {onCustomChecksDisabled?: () => void} = {},
): Promise<T> {
  const context = {json: commandEventOutputMode() === 'json', ...options}
  if (!context.json && !context.onCustomChecksDisabled) return run()

  if (activeChecks === 0) {
    originalConsoleError = console.error
    console.error = (...args: unknown[]) => {
      const current = themeCheckDiagnostics.getStore()
      if (current) {
        const message = format(...args)
        // The upstream loader exposes this notice through console.error. Defer it to
        // the text summary while preserving the diagnostic event for JSON output.
        if (message === customChecksDisabledWarning && current.onCustomChecksDisabled) {
          current.onCustomChecksDisabled()
          if (!current.json) return
        }
        if (current.json) {
          emitCommandEvent({type: 'diagnostic', level: 'warning', message})
          return
        }
      }
      originalConsoleError(...args)
    }
  }
  activeChecks++
  try {
    return await themeCheckDiagnostics.run(context, run)
  } finally {
    releaseConsoleError()
  }
}

function releaseConsoleError(): void {
  activeChecks--
  if (activeChecks === 0) console.error = originalConsoleError
}
/* eslint-enable no-console */

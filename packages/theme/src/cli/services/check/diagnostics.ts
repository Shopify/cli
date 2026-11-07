/* eslint-disable no-console -- Adapts the upstream config validator's direct console output. */
import {commandEventOutputMode, emitCommandEvent} from '@shopify/cli-kit/node/command-events'
import {AsyncLocalStorage} from 'node:async_hooks'
import {format} from 'node:util'

const themeCheckDiagnostics = new AsyncLocalStorage<boolean>()
let activeChecks = 0
let originalConsoleError: typeof console.error

// Theme Check's config validator bypasses its logger and calls console.error directly.
// Keep interception scoped to these async calls, including overlapping environments.
export async function withThemeCheckDiagnostics<T>(run: () => Promise<T>): Promise<T> {
  if (commandEventOutputMode() !== 'json') return run()

  if (activeChecks === 0) {
    originalConsoleError = console.error
    console.error = (...args: unknown[]) => {
      if (themeCheckDiagnostics.getStore()) {
        emitCommandEvent({type: 'diagnostic', level: 'warning', message: format(...args)})
      } else {
        originalConsoleError(...args)
      }
    }
  }
  activeChecks++
  try {
    return await themeCheckDiagnostics.run(true, run)
  } finally {
    releaseConsoleError()
  }
}

function releaseConsoleError(): void {
  activeChecks--
  if (activeChecks === 0) console.error = originalConsoleError
}
/* eslint-enable no-console */

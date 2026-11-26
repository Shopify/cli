/* eslint-disable no-console -- Adapts the upstream config validator's direct console output. */
import {commandEventOutputMode, emitCommandEvent} from '@shopify/cli-kit/node/command-events'
import {AsyncLocalStorage} from 'node:async_hooks'
import {format} from 'node:util'
import type {ConfigDiagnostic} from '@shopify/theme-check-node'

interface ThemeCheckDiagnosticContext {
  json: boolean
}

const themeCheckDiagnostics = new AsyncLocalStorage<ThemeCheckDiagnosticContext>()
let activeChecks = 0
let originalConsoleError: typeof console.error

// Theme Check's config validator bypasses its logger and calls console.error directly.
// Keep interception scoped to these async calls, including overlapping environments.
export async function withThemeCheckDiagnostics<T>(
  run: (onDiagnostic: (diagnostic: ConfigDiagnostic) => void) => Promise<T>,
  options: {
    onCustomChecksDisabled?: () => void
    onDiagnostic?: (diagnostic: ConfigDiagnostic) => void
  } = {},
): Promise<T> {
  const context = {json: commandEventOutputMode() === 'json'}
  const onDiagnostic = (diagnostic: ConfigDiagnostic) => {
    options.onDiagnostic?.(diagnostic)
    if (diagnostic.code === 'custom-checks-disabled' && options.onCustomChecksDisabled) {
      options.onCustomChecksDisabled()
      if (!context.json) return
    }
    if (context.json) {
      emitCommandEvent({type: 'diagnostic', level: diagnostic.level, message: diagnostic.message})
    } else {
      console.error(diagnostic.message)
    }
  }
  if (!context.json) return run(onDiagnostic)

  if (activeChecks === 0) {
    originalConsoleError = console.error
    console.error = (...args: unknown[]) => {
      const current = themeCheckDiagnostics.getStore()
      if (current) {
        const message = format(...args)
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
    return await themeCheckDiagnostics.run(context, () => run(onDiagnostic))
  } finally {
    releaseConsoleError()
  }
}

function releaseConsoleError(): void {
  activeChecks--
  if (activeChecks === 0) console.error = originalConsoleError
}
/* eslint-enable no-console */

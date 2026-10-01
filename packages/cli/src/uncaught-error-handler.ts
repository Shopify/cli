import fs from 'fs'

function writeRawError(error: unknown): void {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
  fs.writeSync(process.stderr.fd, `${message}\n`)
}

/**
 * Renders an exception raised outside oclif's command lifecycle.
 *
 * @param error - Uncaught exception to render.
 */
export async function renderUncaughtError(error: unknown): Promise<void> {
  try {
    const {jsonOutputEnabled} = await import('@shopify/cli-kit/node/environment')
    if (jsonOutputEnabled()) {
      const {handler} = await import('@shopify/cli-kit/node/error')
      await handler(error)
      return
    }

    const {FatalError} = await import('@shopify/cli-kit/node/error')
    if (error instanceof FatalError) {
      const {renderFatalError} = await import('@shopify/cli-kit/node/ui')
      renderFatalError(error)
    } else {
      writeRawError(error)
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    writeRawError(error)
  }
}

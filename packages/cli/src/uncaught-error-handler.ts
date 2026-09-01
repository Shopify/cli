import fs from 'fs'

function writeRawError(error: unknown): void {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
  fs.writeSync(process.stderr.fd, `${message}\n`)
}

/** Waits for queued stdout writes to reach their destination. */
export async function flushStdout(): Promise<void> {
  // The uncaught-exception entry points call process.exit immediately after this handler.
  // Queueing an empty write lets every earlier JSON write reach a pipe before the process exits.
  await new Promise<void>((resolve, reject) => {
    process.stdout.write('', (error) => {
      if (error) reject(error)
      else resolve()
    })
  })
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
      await flushStdout()
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

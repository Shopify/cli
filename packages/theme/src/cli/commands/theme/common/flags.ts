import {AbortError} from '@shopify/cli-kit/node/error'
import {checkPortAvailability, getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'

/**
 * Resolves the port to bind to, reusing the shared TCP helpers and matching
 * the remote flow's UX: an explicitly-requested-but-taken port is a hard error.
 */
export async function resolvePort(port: number): Promise<number> {
  const a0 = performance.now()
  const isAvailable = await checkPortAvailability(port)
  const b0 = performance.now()
  // eslint-disable-next-line no-console
  console.log(b0 - a0)

  if (!isAvailable) {
    const msg = `Port ${port} is not available. Try a different port or remove the --port flag to use an available port.`
    throw new AbortError(msg)
  }

  return getAvailableTCPPort(port)
}

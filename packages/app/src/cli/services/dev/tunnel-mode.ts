import {ports} from '../../constants.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'

export type TunnelMode = NoTunnel | AutoTunnel | NgrokTunnel | CustomTunnel

export interface NoTunnel {
  mode: 'use-localhost'
  actualPort: number
  requestedPort: number
}

export interface AutoTunnel {
  mode: 'auto'
}

export interface NgrokTunnel {
  mode: 'ngrok'
}

export interface CustomTunnel {
  mode: 'custom'
  url: string
}

/**
 * Gets the tunnel or localhost config for doing app dev
 * @param options - Options required for the config
 * @returns A tunnel configuration object
 */
export async function getTunnelMode({
  useLocalhost,
  localhostPort,
  tunnelUrl,
  useNgrok,
}: {
  tunnelUrl?: string
  useLocalhost?: boolean
  localhostPort?: number
  useNgrok?: boolean
}): Promise<TunnelMode> {
  // Developer brought their own tunnel
  if (tunnelUrl) {
    return {mode: 'custom', url: tunnelUrl}
  }

  // CLI should create a tunnel
  if (!useLocalhost && !localhostPort) {
    if (useNgrok) {
      return {
        mode: 'ngrok',
      }
    }
    return {
      mode: 'auto',
    }
  }

  const requestedPort = localhostPort ?? ports.localhost
  const actualPort = await getAvailableTCPPort(requestedPort)

  // The user specified a port. It's not available. Abort!
  if (localhostPort && actualPort !== requestedPort) {
    const errorMessage = `Port ${localhostPort} is not available.`
    const tryMessage = ['Choose a different port for the', {command: '--localhost-port'}, 'flag.']
    throw new AbortError(errorMessage, tryMessage)
  }

  return {
    mode: 'use-localhost',
    requestedPort,
    actualPort,
  }
}

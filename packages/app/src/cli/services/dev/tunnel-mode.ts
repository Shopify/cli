import {ports} from '../../constants.js'
import {generateCertificate} from '../../utilities/mkcert.js'
import {generateCertificatePrompt} from '../../prompts/dev.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export type TunnelMode = NoTunnel | AutoTunnel | CustomTunnel

export interface NoTunnel {
  mode: 'use-localhost'
  actualPort: number
  requestedPort: number
  provideCertificate: (appDirectory: string) => Promise<{keyContent: string; certContent: string; certPath: string}>
}

export interface AutoTunnel {
  mode: 'auto'
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
}: {
  tunnelUrl?: string
  useLocalhost?: boolean
  localhostPort?: number
}): Promise<TunnelMode> {
  // Developer brought their own tunnel
  if (tunnelUrl) {
    return {mode: 'custom', url: tunnelUrl}
  }

  // CLI should create a tunnel
  if (!useLocalhost && !localhostPort) {
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
    provideCertificate: async (appDirectory) => {
      renderInfo({
        headline: 'Localhost-based development is in developer preview.',
        body: [
          '`--use-localhost` is not compatible with Shopify features which directly invoke your app',
          '(such as Webhooks, App proxy, and Flow actions), or those which require testing your app from another',
          'device (such as POS). Please report any issues and provide feedback on the dev community:',
        ],
        link: {
          label: 'Create a feedback post',
          url: 'https://community.shopify.dev/new-topic?category=shopify-cli-libraries&tags=app-dev-on-localhost',
        },
      })

      return generateCertificate({
        appDirectory,
        onRequiresConfirmation: generateCertificatePrompt,
      })
    },
  }
}

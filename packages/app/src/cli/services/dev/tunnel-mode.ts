import {PortWarning} from './port-warnings.js'
import {ports} from '../../constants.js'
import {generateCertificate} from '../../utilities/mkcert.js'
import {generateCertificatePrompt} from '../../prompts/dev.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export type TunnelMode = NoTunnel | AutoTunnel | CustomTunnel

export interface NoTunnel {
  mode: 'use-localhost'
  port: number
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
  portWarnings,
}: {
  tunnelUrl?: string
  useLocalhost?: boolean
  localhostPort?: number
  portWarnings: PortWarning[]
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

  // The user didn't specify a port. The default isn't available. Add to warnings array
  // This will be rendered using renderWarning later when dev() is called
  // This allows us to consolidate all port warnings into one renderWarning message
  if (requestedPort !== actualPort) {
    portWarnings.push({
      type: 'localhost',
      requestedPort,
      flag: '--localhost-port',
    })
  }

  return {
    mode: 'use-localhost',
    port: actualPort,
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

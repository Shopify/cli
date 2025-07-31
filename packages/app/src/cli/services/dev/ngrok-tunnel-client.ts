import {TunnelClient, TunnelStatusType} from '@shopify/cli-kit/node/plugins/tunnel'
import {outputDebug} from '@shopify/cli-kit/node/output'
import ngrok from 'ngrok'

export class NgrokTunnelClient implements TunnelClient {
  port: number
  provider = 'ngrok'

  private currentStatus: TunnelStatusType = {status: 'not-started'}
  private ngrokUrl: string | undefined

  constructor(port: number) {
    this.port = port
  }

  async startTunnel(): Promise<void> {
    try {
      this.currentStatus = {status: 'starting'}
      outputDebug('Starting ngrok tunnel...')

      this.ngrokUrl = await ngrok.connect({
        addr: this.port,
        authtoken_from_env: true,
      })

      outputDebug(`Ngrok tunnel started: ${this.ngrokUrl}`)
      this.currentStatus = {status: 'connected', url: this.ngrokUrl}

      // Setup cleanup handlers
      const cleanup = () => {
        ngrok.disconnect().catch((error) => {
          outputDebug(`Ngrok disconnect error: ${error}`)
        })
        ngrok.kill().catch((error) => {
          outputDebug(`Ngrok kill error: ${error}`)
        })
      }

      process.on('SIGINT', cleanup)
      process.on('SIGTERM', cleanup)
      process.on('exit', cleanup)
    } catch (error) {
      let errorMessage = 'Failed to start ngrok tunnel'
      let tryMessage = [
        'You can run the command again, or try networking with Shopify via',
        {command: '--use-localhost'},
        'or',
        {command: '--tunnel-url <custom tunnel>'},
        '.',
      ]

      if (error instanceof Error) {
        if (error.message.includes('authtoken')) {
          errorMessage = 'Failed to start ngrok tunnel: Invalid or missing auth token'
          tryMessage = [
            'Get your auth token from https://dashboard.ngrok.com/get-started/your-authtoken',
            'Then set the NGROK_AUTHTOKEN environment variable or configure ngrok with:',
            {command: 'ngrok config add-authtoken <your-token>'},
          ]
        } else {
          errorMessage = `Failed to start ngrok tunnel: ${error.message}`
        }
      } else {
        throw error
      }

      this.currentStatus = {
        status: 'error',
        message: errorMessage,
        tryMessage,
      }
    }
  }

  getTunnelStatus(): TunnelStatusType {
    return this.currentStatus
  }

  stopTunnel(): void {
    ngrok.disconnect().catch(() => {
      // Ignore errors during shutdown
    })
    ngrok.kill().catch(() => {
      // Ignore errors during shutdown
    })
  }
}

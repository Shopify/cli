import {ensureDevEnvironment} from './environment.js'
import {generateURL} from '../dev/urls.js'
import {HydrogenApp} from '../../hydrogen/models/app.js'
import {error, port, session} from '@shopify/cli-kit'
import {Config} from '@oclif/core'

export interface DevOptions {
  app: HydrogenApp
  apiKey?: string
  storeFqdn?: string
  reset: boolean
  update: boolean
  commandConfig: Config
  subscriptionProductUrl?: string
  checkoutCartUrl?: string
  tunnelUrl?: string
}

async function dev(options: DevOptions) {
  const token = await session.ensureAuthenticatedPartners()
  const {
    identifiers,
    storeFqdn,
    app: {apiSecret},
  } = await ensureDevEnvironment(options, token)

  let proxyPort: number
  let url: string
  if (options.tunnelUrl) {
    const matches = options.tunnelUrl.match(/(https:\/\/[^:]+):([0-9]+)/)
    if (!matches) {
      throw new error.Abort(`Invalid tunnel URL: ${options.tunnelUrl}`, 'Valid format: "https://my-tunnel-url:port"')
    }
    proxyPort = Number(matches[2])
    url = matches[1]
  } else {
    proxyPort = await port.getRandomPort()
    url = await generateURL(options.commandConfig.plugins, proxyPort)
  }
}

export default dev

import {TUNNEL_PROVIDER} from './provider.js'
import {stopTunnel} from '@shopify/cli-kit/node/plugins/tunnel'
import ngrok from '@shopify/ngrok'

export default stopTunnel({provider: TUNNEL_PROVIDER, action: () => ngrok.kill()})

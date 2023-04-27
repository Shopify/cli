import {TUNNEL_PROVIDER} from './provider.js'
import {stopTunnel} from '@shopify/cli-kit/node/plugins/tunnel'
import {stopCloudflareProcess} from './tunnel.js'

export default stopTunnel({provider: TUNNEL_PROVIDER, action: stopCloudflareProcess})

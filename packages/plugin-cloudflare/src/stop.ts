import {TUNNEL_PROVIDER} from './provider.js'
import {stopCloudflareProcess} from './tunnel.js'
import {stopTunnel} from '@shopify/cli-kit/node/plugins/tunnel'

export default stopTunnel({provider: TUNNEL_PROVIDER, action: stopCloudflareProcess})

import {TUNNEL_PROVIDER} from './provider.js'
import {getCurrentStatus} from './tunnel.js'
import {tunnelStatus} from '@shopify/cli-kit/node/plugins/tunnel'
import {ok} from '@shopify/cli-kit/node/result'

export default tunnelStatus({
  provider: TUNNEL_PROVIDER,
  action: async () => {
    const aa = await getCurrentStatus()
    return ok(aa)
  },
})

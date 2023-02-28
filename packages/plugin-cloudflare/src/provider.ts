import {defineProvider} from '@shopify/cli-kit/node/plugins/tunnel'

export const TUNNEL_PROVIDER = 'cloudflare'
export default defineProvider({name: TUNNEL_PROVIDER})

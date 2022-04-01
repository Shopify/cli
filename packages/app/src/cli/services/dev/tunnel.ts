import {output, tunnel} from '@shopify/cli-kit'

export async function createTunnel(): Promise<string> {
  const url = await tunnel.create()
  output.success(`ngrok tunnel running at ${url}`)
  return url
}

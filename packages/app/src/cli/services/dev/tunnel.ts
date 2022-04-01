import {tunnel} from '@shopify/cli-kit'

interface CreateTunnelOptions {
  port: number
}

export async function createTunnel(options: CreateTunnelOptions): Promise<string> {
  const url = await tunnel.create({ port: options.port})
  await tunnel.authToken('6p8aPPMh1jkjT6TDc82pX_2T8SRKzqZYTcZNL65nsNw')
  return url
}

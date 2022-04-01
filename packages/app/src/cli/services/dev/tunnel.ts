import {tunnel} from '@shopify/cli-kit'

export async function createTunnel(): Promise<string> {
  const url = await tunnel.create()
  await tunnel.authToken('6p8aPPMh1jkjT6TDc82pX_2T8SRKzqZYTcZNL65nsNw')
  return url
}

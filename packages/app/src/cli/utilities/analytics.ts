import {Config} from '@oclif/core'
import {getListOfTunnelPlugins} from '@shopify/cli-kit/node/plugins'

/**
 * Return the name of the tunnel provider used to send analytics. Returns 'localhost' or provider name if any of those
 * strings are included in the {@link tunnelUrl} param. Returns 'custom' otherwise
 *
 * @param options - Oclif configuration. Needed to call the hook for retrieving the list of tunner providers
 * @param tunnelUrl - Tunnel url. Used as pattern to match provider name
 * @returns 'localhost' or provider name if any of those strings are included in
 *  the tunnelUrl or 'custom' otherwise
 */

export async function getAnalyticsTunnelType(options: Config, tunnelUrl: string): Promise<string | undefined> {
  if (!tunnelUrl) {
    return
  }

  if (tunnelUrl.includes('localhost')) {
    return 'localhost'
  }

  const provider = (await getListOfTunnelPlugins(options)).plugins.find((plugin) => tunnelUrl?.includes(plugin))
  return provider ?? 'custom'
}

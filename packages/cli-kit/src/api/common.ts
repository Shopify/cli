import {isShopify} from '../environment/local'
import constants from '../constants'
import {randomUUID} from 'crypto'

export async function buildHeaders(token: string): Promise<{[key: string]: string}> {
  const userAgent = `Shopify CLI; v=${constants.versions.cli}`
  const isEmployee = await isShopify()

  const headers = {
    /* eslint-disable @typescript-eslint/naming-convention */
    'User-Agent': userAgent,
    // 'Sec-CH-UA': secCHUA, This header requires the Git sha.
    'Sec-CH-UA-PLATFORM': process.platform,
    'X-Request-Id': randomUUID(),
    authorization: `Bearer ${token}`,
    'X-Shopify-Access-Token': `Bearer ${token}`,
    'Content-Type': 'application/json',
    // ...(isEmployee && {'X-Shopify-Cli-Employee': '1'}),
    /* eslint-enable @typescript-eslint/naming-convention */
  }

  return headers
}

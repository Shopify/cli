import {isShopify} from '../environment/local'
import constants from '../constants'
import {randomUUID} from 'crypto'

export async function buildHeaders(token: string): Promise<{[key: string]: any}> {
  const userAgent = `Shopify CLI; v=${constants.versions.cli}`
  const isEmployee = await isShopify()

  const headers = {
    'User-Agent': userAgent,
    // 'Sec-CH-UA': secCHUA, This header requires the Git sha.
    'Sec-CH-UA-PLATFORM': process.platform,
    'X-Request-Id': randomUUID(),
    authorization: token,
    'X-Shopify-Access-Token': token,
    ...(isEmployee && {'X-Shopify-Cli-Employee': '1'}),
  }

  return headers
}

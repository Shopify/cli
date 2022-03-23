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
    authorization: `Bearer ${token}`,
    'X-Shopify-Access-Token': `Bearer ${token}`,
    'Content-Type': 'application/json',
    // ...(isEmployee && {'X-Shopify-Cli-Employee': '1'}),
  }

  return headers
}

// {"User-Agent"=>"Shopify CLI; v=2.12.0", "Sec-CH-UA"=>"Shopify CLI; v=2.12.0 sha=b5ab5bef91b0dde7b586faa39c1e71c07ffae4dd", "Sec-CH-UA-PLATFORM"=>"mac", "X-Request-Id"=>"fdf00e4e-6784-4a65-ba6c-59c841c4683c"

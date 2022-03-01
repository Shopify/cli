import {randomUUID} from 'crypto'

import constants from '../constants'

export function buildHeaders(token: string): {[key: string]: any} {
  const userAgent = `Shopify CLI; v=${constants.versions.cli}`

  // Employee data not available yet
  const isEmployee = true

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

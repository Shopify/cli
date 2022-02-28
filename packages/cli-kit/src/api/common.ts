import {randomUUID} from 'crypto'

import {currentCLIKitVersion} from '../version'

export function buildHeaders(token: string): {[key: string]: any} {
  const version = currentCLIKitVersion()

  // This works if CLI and CLI-KIT versions are the same
  // cli-kit can't know cli's version
  const userAgent = `Shopify CLI; v=${version}`

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

import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo, type InlineToken} from '@shopify/cli-kit/node/ui'
import {capitalizeWords} from '@shopify/cli-kit/common/string'
import type {StoreInfoResult, StoreInfoStoreOwner} from './types.js'

type StoreInfoOutputFormat = 'text' | 'json'

export function renderStoreInfoResult(result: StoreInfoResult, format: StoreInfoOutputFormat): void {
  if (format === 'json') {
    outputResult(JSON.stringify(result, null, 2))
    return
  }
  renderInfo({
    customSections: [{title: 'Store details', body: {tabularData: storeDetailRows(result), firstColumnSubdued: true}}],
  })
}

function storeDetailRows(result: StoreInfoResult): InlineToken[][] {
  const rows: InlineToken[][] = []
  push(rows, 'ID', result.id)
  push(rows, 'Display Name', result.displayName)
  push(rows, 'Subdomain', result.subdomain)
  push(rows, 'Organization', result.organizationName)
  push(rows, 'Store owner', formatOwner(result.storeOwner))
  push(rows, 'Type', result.type ? capitalizeWords(result.type) : undefined)
  push(rows, 'Plan', result.plan ? capitalizeWords(result.plan) : undefined)
  push(rows, 'Feature Preview', result.featurePreview)
  pushLink(rows, 'Admin URL', result.adminUrl)
  pushLink(rows, 'Access URL', result.accessUrl)
  pushLink(rows, 'Save URL', result.saveUrl)
  return rows
}

function formatOwner(owner: StoreInfoStoreOwner | undefined): string | undefined {
  if (!owner) return undefined
  if (owner.name && owner.email) return `${owner.name} (${owner.email})`
  return owner.name ?? owner.email
}

function push(rows: InlineToken[][], label: string, value: string | undefined): void {
  if (value) rows.push([label, value])
}

function pushLink(rows: InlineToken[][], label: string, url: string | undefined): void {
  if (url) rows.push([label, {link: {label: 'Link', url}}])
}

import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import {capitalizeWords} from '@shopify/cli-kit/common/string'
import type {StoreInfoResult, StoreInfoStoreOwner} from './types.js'
import type {InlineToken, TokenItem} from '@shopify/cli-kit/node/ui'

type StoreInfoOutputFormat = 'text' | 'json'

export function renderStoreInfoResult(result: StoreInfoResult, format: StoreInfoOutputFormat): void {
  if (format === 'json') {
    outputResult(JSON.stringify(result, null, 2))
    return
  }
  renderInfo({
    customSections: [{title: 'Store details', body: {list: {items: storeDetailItems(result)}}}],
  })
}

function storeDetailItems(result: StoreInfoResult): TokenItem<InlineToken>[] {
  const items: TokenItem<InlineToken>[] = []
  push(items, 'ID', result.id)
  push(items, 'Display Name', result.displayName)
  push(items, 'Subdomain', result.subdomain)
  push(items, 'Organization', result.organizationName)
  push(items, 'Store owner', formatOwner(result.storeOwner))
  push(items, 'Type', result.type ? capitalizeWords(result.type) : undefined)
  push(items, 'Plan', result.plan ? capitalizeWords(result.plan) : undefined)
  push(items, 'Feature Preview', result.featurePreview)
  pushLink(items, 'Admin URL', result.adminUrl)
  pushLink(items, 'Access URL', result.accessUrl)
  pushLink(items, 'Save URL', result.saveUrl)
  return items
}

function formatOwner(owner: StoreInfoStoreOwner | undefined): string | undefined {
  if (!owner) return undefined
  if (owner.name && owner.email) return `${owner.name} (${owner.email})`
  return owner.name ?? owner.email
}

function push(items: TokenItem<InlineToken>[], label: string, value: string | undefined): void {
  if (value) items.push(`${label}: ${value}`)
}

// Render URLs as link tokens so they don't wrap awkwardly inside the bordered
// box. The UI kit renders link tokens as a compact footnote reference within
// the box and prints the full URL outside it, where it can wrap freely.
function pushLink(items: TokenItem<InlineToken>[], label: string, url: string | undefined): void {
  if (url) items.push([`${label}:`, {link: {label: url, url}}])
}

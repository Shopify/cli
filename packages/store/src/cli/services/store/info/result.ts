import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import {capitalizeWords} from '@shopify/cli-kit/common/string'
import type {StoreInfoResult, StoreInfoStoreOwner} from './types.js'

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

function storeDetailItems(result: StoreInfoResult): string[] {
  const items: string[] = []
  push(items, 'ID', result.id)
  push(items, 'Display Name', result.displayName)
  push(items, 'Subdomain', result.subdomain)
  push(items, 'Organization', result.organizationName)
  push(items, 'Store owner', formatOwner(result.storeOwner))
  push(items, 'Type', result.type ? capitalizeWords(result.type) : undefined)
  push(items, 'Plan', result.plan ? capitalizeWords(result.plan) : undefined)
  push(items, 'Feature Preview', result.featurePreview)
  push(items, 'Admin URL', result.adminUrl)
  push(items, 'Save URL', result.saveUrl)
  return items
}

function formatOwner(owner: StoreInfoStoreOwner | undefined): string | undefined {
  if (!owner) return undefined
  if (owner.name && owner.email) return `${owner.name} (${owner.email})`
  return owner.name ?? owner.email
}

function push(items: string[], label: string, value: string | undefined): void {
  if (value) items.push(`${label}: ${value}`)
}

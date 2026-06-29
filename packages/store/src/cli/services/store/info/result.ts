import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo, type InlineToken, type LinkToken} from '@shopify/cli-kit/node/ui'
import {capitalizeWords} from '@shopify/cli-kit/common/string'
import type {StoreInfoResult, StoreInfoStoreOwner} from './types.js'

type StoreInfoOutputFormat = 'text' | 'json'

export function renderStoreInfoResult(result: StoreInfoResult, format: StoreInfoOutputFormat): void {
  if (format === 'json') {
    outputResult(JSON.stringify(result, null, 2))
    return
  }
  const actions = storeActions(result)
  renderInfo({
    customSections: [
      {title: 'Store details', body: {tabularData: storeDetailRows(result), firstColumnSubdued: true}},
      ...(actions.length > 0 ? [{body: {list: {title: {bold: 'Next steps'}, items: actions}}}] : []),
    ],
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
  return rows
}

function storeActions(result: StoreInfoResult): LinkToken[] {
  const actions: LinkToken[] = []
  pushAction(actions, result.adminUrl, 'Manage this store in the Shopify admin')
  pushAction(actions, result.accessUrl, 'View your store')
  pushAction(actions, result.saveUrl, 'Save your store')
  return actions
}

function formatOwner(owner: StoreInfoStoreOwner | undefined): string | undefined {
  if (!owner) return undefined
  if (owner.name && owner.email) return `${owner.name} (${owner.email})`
  return owner.name ?? owner.email
}

function push(rows: InlineToken[][], label: string, value: string | undefined): void {
  if (value) rows.push([label, value])
}

function pushAction(actions: LinkToken[], url: string | undefined, label: string): void {
  if (url) actions.push({link: {label, url}})
}

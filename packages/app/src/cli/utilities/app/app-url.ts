import {normalizeStoreFqdn, storeAdminUrl} from '@shopify/cli-kit/node/context/fqdn'

export function buildAppURLForWeb(storeFqdn: string, apiKey: string) {
  const normalizedFQDN = normalizeStoreFqdn(storeFqdn)
  const adminUrl = storeAdminUrl(normalizedFQDN)
  return `https://${adminUrl}/admin/oauth/redirect_from_cli?client_id=${apiKey}`
}

export function buildAppURLForMobile(storeFqdn: string, apiKey: string) {
  const normalizedFQDN = normalizeStoreFqdn(storeFqdn)
  const adminUrl = storeAdminUrl(normalizedFQDN)
  const hostUrl = `${adminUrl}/admin/apps/${apiKey}`
  const hostParam = Buffer.from(hostUrl).toString('base64').replace(/[=]/g, '')
  return `https://${hostUrl}?shop=${normalizedFQDN}&host=${hostParam}`
}

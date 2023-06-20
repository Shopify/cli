export function buildAppURLForWeb(storeFqdn: string, apiKey: string) {
  return `https://${storeFqdn}/admin/oauth/redirect_from_cli?client_id=${apiKey}`
}

export function buildAppURLForMobile(storeFqdn: string, apiKey: string) {
  const hostUrl = `${storeFqdn}/admin/apps/${apiKey}`
  const hostParam = Buffer.from(hostUrl).toString('base64').replace(/[=]/g, '')
  return `https://${hostUrl}?shop=${storeFqdn}&host=${hostParam}`
}

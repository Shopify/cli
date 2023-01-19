export function buildAppURLForWeb(storeFqdn: string, publicURL: string) {
  const hostUrl = `${storeFqdn}/admin`
  const hostParam = Buffer.from(hostUrl).toString('base64').replace(/[=]/g, '')
  return `${publicURL}?shop=${storeFqdn}&host=${hostParam}`
}

export function buildAppURLForMobile(storeFqdn: string, apiKey: string) {
  const hostUrl = `${storeFqdn}/admin/apps/${apiKey}`
  const hostParam = Buffer.from(hostUrl).toString('base64').replace(/[=]/g, '')
  return `https://${hostUrl}?shop=${storeFqdn}&host=${hostParam}`
}

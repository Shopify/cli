/**
 * Given a store, returns a valid store fqdn removing protocol and adding .myshopify.com domain
 * @param store Original store name provided by the user
 * @returns a valid store fqdn
 */
export function parseStoreName(store: string) {
  const storeFqdn = store.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return storeFqdn.includes('.myshopify.com') ? storeFqdn : `${storeFqdn}.myshopify.com`
}

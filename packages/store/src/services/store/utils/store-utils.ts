export function storeFullDomain(storeDomain: string): string {
  return storeDomain.match(/myshopify.com$/i) ? storeDomain : `${storeDomain}.myshopify.com`
}

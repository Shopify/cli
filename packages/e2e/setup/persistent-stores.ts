/** Read every configured persistent store that cleanup must protect. */
export function readPersistentStores(env: NodeJS.ProcessEnv = process.env, required = true): string[] {
  const value = [env.E2E_STORE_FQDNS, env.E2E_STORE_FQDN].join(' ')
  if (!value.trim()) {
    if (!required) return []
    throw new Error('E2E_STORE_FQDNS must contain existing development-store domains.')
  }

  const stores = value
    .trim()
    .split(/[\s,]+/)
    .map((store) => store.toLowerCase())
  for (const store of stores) {
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(store)) {
      throw new Error(`Invalid E2E store domain: ${store}. Use a full myshopify.com domain.`)
    }
  }
  return [...new Set(stores)]
}

/** Persistent test stores must never be removed by the cleanup scripts. */
export function isProtectedStore(storeFqdn: string, configuredStores: string[] = []): boolean {
  const domain = storeFqdn.toLowerCase()
  return domain.startsWith('no-delete-e2e-') || configuredStores.includes(domain)
}

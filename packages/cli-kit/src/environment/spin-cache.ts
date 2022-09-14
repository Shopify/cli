let cachedSpinFQDN: string

export function getCachedSpinFqdn(): string | undefined {
  return cachedSpinFQDN
}

export function setCachedSpinFqdn(fqdn: string) {
  cachedSpinFQDN = fqdn
}

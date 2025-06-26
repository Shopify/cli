export function isStoreIdentifier(value: string): boolean {
  return value.endsWith('.myshopify.com')
}

export function isFileIdentifier(value: string): boolean {
  return value.endsWith('.sqlite') || value === '<sqlite>'
}
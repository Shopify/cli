import {sha256 as sha256Buffer} from '@shopify/cli-kit/node/crypto'

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function sha256(value: unknown): string {
  const input = typeof value === 'string' ? value : canonicalJson(value)
  return `sha256:${sha256Buffer(input).toString('hex')}`
}

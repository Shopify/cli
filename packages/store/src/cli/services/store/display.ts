import {extractHost} from '@shopify/cli-kit/common/url'

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: '2-digit',
  year: 'numeric',
})

export function formatShortDate(value: Date | number | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return shortDateFormatter.format(date)
}

export function extractSubdomain(value: string | null | undefined): string | undefined {
  const host = extractHost(value)
  if (!host) return undefined
  return host.split('.')[0]
}

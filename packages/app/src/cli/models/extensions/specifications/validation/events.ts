import {zod} from '@shopify/cli-kit/node/schema'
import {AbortError} from '@shopify/cli-kit/node/error'

export const EventSubscriptionHandleSchema = zod.string().regex(/^[a-zA-Z0-9_-]{1,50}$/)

export function eventSubscriptionHandle(value: unknown, owner: 'module' | 'subscription' = 'subscription'): string {
  const result = EventSubscriptionHandleSchema.safeParse(value)
  if (!result.success) {
    throw new AbortError(`Events ${owner} handle must contain 1–50 letters, digits, underscores, or hyphens.`)
  }
  return result.data
}

export function eventSubscriptions(value: unknown): Record<string, unknown>[] {
  if (value === undefined || value === null) return []
  const result = zod.union([zod.record(zod.unknown()), zod.array(zod.record(zod.unknown()))]).safeParse(value)
  if (!result.success) throw new AbortError('Events subscription must be an object or an array of objects.')
  if (Array.isArray(result.data)) return result.data
  return Object.keys(result.data).length === 0 ? [] : [result.data]
}

import {zod} from '@shopify/cli-kit/node/schema'

export function isType<T extends zod.ZodTypeAny>(schema: T, item: unknown): item is zod.infer<T> {
  return schema.safeParse(item).success
}

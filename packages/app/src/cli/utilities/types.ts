import {zod} from '@shopify/cli-kit/node/schema'

export function isType<T extends zod.ZodTypeAny>(schema: T, item: unknown): item is zod.infer<T> {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  // console.log(schema.safeParse(item).error)
  return schema.safeParse(item).success
}

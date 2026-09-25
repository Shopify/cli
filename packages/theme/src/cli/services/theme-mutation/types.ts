import {zod} from '@shopify/cli-kit/node/schema'

export const ThemeMutationThemeSchema = zod.object({
  id: zod.number(),
  name: zod.string(),
  role: zod.string(),
  processing: zod.boolean(),
  createdAtRuntime: zod.boolean(),
  src: zod.string().optional(),
  shop: zod.string(),
})

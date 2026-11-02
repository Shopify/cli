import {zod} from '@shopify/cli-kit/node/schema'

export const ThemeMutationSuccessSchema = zod.object({status: zod.literal('success')})

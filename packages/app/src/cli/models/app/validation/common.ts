import {zod} from '@shopify/cli-kit/node/schema'

// adding http or https presence and absence of new lines to url validation
export const httpsRegex = /^(https:\/\/)/
export const validateUrl = (zodType: zod.ZodString, {httpsOnly = false, message = 'Invalid url'} = {}) => {
  const regex = httpsOnly ? httpsRegex : /^(https?:\/\/)/
  return zodType
    .url()
    .refine((value) => Boolean(value.match(regex)), {message})
    .refine((value) => !value.includes('\n'), {message})
}

export const ensurePathStartsWithSlash = (arg: unknown) =>
  typeof arg === 'string' && !arg.startsWith('/') ? `/${arg}` : arg

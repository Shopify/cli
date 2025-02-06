import {zod} from '@shopify/cli-kit/node/schema'

export function validateUrl(zodType: zod.ZodString, {httpsOnly = false, message = 'Invalid URL'} = {}) {
  return zodType
    .refine((value) => isValidUrl(value, httpsOnly), {message})
    .refine((value) => !value.includes('\n'), {message})
}

function isValidUrl(input: string, httpsOnly: boolean) {
  try {
    const url = new URL(input)
    return httpsOnly ? url.protocol === 'https:' : ['http:', 'https:'].includes(url.protocol)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (TypeError) {
    // new URL() throws a TypeError if the input is not a valid URL
    return false
  }
}

export function ensurePathStartsWithSlash(arg: unknown) {
  return typeof arg === 'string' && !arg.startsWith('/') ? `/${arg}` : arg
}

export const APP_NAME_MAX_LENGTH = 30

export function isValidName(name: string): boolean {
  return name.length <= APP_NAME_MAX_LENGTH
}
